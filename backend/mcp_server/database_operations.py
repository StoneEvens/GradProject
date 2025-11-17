from typing import Dict, Literal
from datetime import datetime, date, time
from accounts.models import CustomUser, Plan
from pets.models import (
    Pet, AbnormalPost, DiseaseArchiveContent, Symptom, Illness,
    PostSymptomsRelation, ArchiveAbnormalPostRelation, ArchiveIllnessRelation
)
from social.models import PostFrame, SoLContent, PostHashtag
from media.models import AbnormalPostImage
from django.db import transaction
import logging
import re

logger = logging.getLogger(__name__)


def get_operation_list() -> Dict:
    """
    返回所有可用的資料庫操作及其參數定義
    
    Returns:
        Dict: 包含所有操作的詳細資訊
    """
    operations = {
        "add_pet": {
            "description": "新增寵物",
            "required_params": ["user_id", "pet_name", "pet_type", "weight", "pet_stage"],
            "optional_params": ["age", "breed", "predicted_adult_weight", "description", "height", "weeks_of_lactation"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "pet_name": "寵物名稱 (字串)",
                "pet_type": "寵物類型 (字串，例如: 'dog', 'cat')",
                "weight": "體重 (浮點數，公斤)",
                "pet_stage": "年齡階段 (字串，選項: 'puppy', 'adult', 'pregnant', 'lactating', 'kitten')",
                "age": "年齡 (整數，歲)",
                "breed": "品種 (字串)",
                "predicted_adult_weight": "預期成犬/成貓體重 (浮點數，公斤)",
                "description": "寵物描述 (字串)",
                "height": "身高 (浮點數，公分)",
                "weeks_of_lactation": "哺乳週數 (整數)"
            }
        },
        "update_pet": {
            "description": "更新寵物資訊",
            "required_params": ["pet_id"],
            "optional_params": ["owner", "weight", "pet_stage", "age", "pet_name", "breed", "pet_type", "predicted_adult_weight", "description"],
            "param_details": {
                "pet_id": "寵物ID (整數)",
                "owner": "新的主人用戶ID (整數)",
                "weight": "體重 (浮點數，公斤)",
                "pet_stage": "年齡階段 (字串，選項: 'puppy', 'adult', 'pregnant', 'lactating', 'kitten')",
                "age": "年齡 (整數，歲)",
                "pet_name": "寵物名稱 (字串)",
                "breed": "品種 (字串)",
                "pet_type": "寵物類型 (字串)",
                "predicted_adult_weight": "預期成犬/成貓體重 (浮點數，公斤)",
                "description": "寵物描述 (字串)"
            }
        },
        "add_abnormal_post": {
            "description": "新增異常記錄（寵物健康異常情況的記錄，不含圖片）。圖片需透過前端另外上傳。",
            "required_params": ["user_id", "pet_id", "symptoms"],
            "optional_params": ["content", "weight", "body_temperature", "water_amount", "is_emergency", "record_date", "is_private"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "pet_id": "寵物ID (整數)",
                "symptoms": "症狀列表 (字串陣列，例如: ['打噴嚏', '咳嗽', '發燒'])",
                "content": "異常描述內容 (字串)",
                "weight": "當時體重 (浮點數，公斤)",
                "body_temperature": "體溫 (浮點數，攝氏度)",
                "water_amount": "飲水量 (整數，毫升)",
                "is_emergency": "是否為就醫記錄 (布林值，預設: False)",
                "record_date": "記錄日期 (字串，ISO格式，例如: '2025-01-15T10:30:00Z')",
                "is_private": "是否為私人記錄 (布林值，預設: True)"
            },
            "notes": [
                "此操作只建立異常記錄結構，不包含圖片",
                "如需上傳圖片，請告知用戶在異常記錄建立後可以上傳圖片"
            ],
            "response_handling": {
                "on_success": "Tool returns {success: true, abnormal_post_id: X, message: '異常記錄建立成功！', note: '...'}",
                "tell_user": "異常記錄建立成功！ + include the note field if present + mention symptoms_added if any",
                "operations_array": "MUST add operation: {operation_name: 'abnormal_post_created', operation_data: json.dumps({abnormal_post_id: X, pet_id: Y, status: 'pending_images'})}",
                "important": "Do NOT mention abnormal_post_id or technical details in the reply field. The abnormal_post_id should ONLY be in operations array for frontend to use."
            },
            "user_responses": {
                "missing_symptoms": "好的！請告訴我寵物出現了哪些症狀呢？",
                "want_upload_images": "異常記錄已建立，您也可以上傳圖片來記錄寵物的狀況喔！"
            }
        },
        "create_disease_archive": {
            "description": "建立疾病檔案（將多個異常記錄整合成一個疾病檔案）",
            "required_params": ["user_id", "pet_id", "archive_title", "content", "abnormal_post_ids"],
            "optional_params": ["main_cause", "go_to_doctor", "health_status", "is_private"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "pet_id": "寵物ID (整數)",
                "archive_title": "檔案標題 (字串)",
                "content": "檔案內容/統整描述 (字串)",
                "abnormal_post_ids": "包含的異常記錄ID列表 (整數陣列，例如: [1, 2, 3])",
                "main_cause": "主要病因 (字串)",
                "go_to_doctor": "是否有就醫 (布林值，預設: False)",
                "health_status": "健康狀態 (字串，例如: '已康復', '治療中')",
                "is_private": "是否為私人記錄 (布林值，預設: True)"
            }
        },
        "update_abnormal_post": {
            "description": "更新異常記錄",
            "required_params": ["user_id", "post_id"],
            "optional_params": ["pet_id", "content", "symptoms", "weight", "body_temperature", "water_amount", "is_emergency", "record_date", "is_private"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "post_id": "異常記錄ID (整數)",
                "pet_id": "新的寵物ID (整數，可用於轉移記錄到其他寵物)",
                "content": "異常描述內容 (字串)",
                "symptoms": "症狀列表 (字串陣列，例如: ['打噴嚏', '咳嗽'])",
                "weight": "當時體重 (浮點數，公斤)",
                "body_temperature": "體溫 (浮點數，攝氏度)",
                "water_amount": "飲水量 (整數，毫升)",
                "is_emergency": "是否為就醫記錄 (布林值)",
                "record_date": "記錄日期 (字串，ISO格式)",
                "is_private": "是否為私人記錄 (布林值)"
            }
        },
        "delete_abnormal_post": {
            "description": "刪除異常記錄",
            "required_params": ["user_id", "post_id"],
            "optional_params": [],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "post_id": "異常記錄ID (整數)"
            }
        },
        "add_plan": {
            "description": "新增當日行程/計劃",
            "required_params": ["user_id", "title", "date"],
            "optional_params": ["description", "start_time", "end_time", "is_completed"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "title": "行程標題 (字串)",
                "date": "日期 (字串，格式: 'YYYY-MM-DD'，例如: '2025-11-15')",
                "description": "行程描述 (字串)",
                "start_time": "開始時間 (字串，格式: 'HH:MM'，例如: '14:30'，預設: '08:00')",
                "end_time": "結束時間 (字串，格式: 'HH:MM'，例如: '16:00'，預設: '09:00')",
                "is_completed": "是否已完成 (布林值，預設: False)"
            }
        },
        "update_plan": {
            "description": "更新行程資訊",
            "required_params": ["user_id", "plan_id"],
            "optional_params": ["title", "description", "date", "start_time", "end_time", "is_completed"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "plan_id": "行程ID (整數)",
                "title": "行程標題 (字串)",
                "description": "行程描述 (字串)",
                "date": "日期 (字串，格式: 'YYYY-MM-DD')",
                "start_time": "開始時間 (字串，格式: 'HH:MM')",
                "end_time": "結束時間 (字串，格式: 'HH:MM')",
                "is_completed": "是否已完成 (布林值)"
            }
        },
        "delete_plan": {
            "description": "刪除行程",
            "required_params": ["user_id", "plan_id"],
            "optional_params": [],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "plan_id": "行程ID (整數)"
            }
        },
        "list_plans": {
            "description": "列出用戶的行程列表",
            "required_params": ["user_id"],
            "optional_params": ["start_date", "end_date", "is_completed"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "start_date": "開始日期 (字串，格式: 'YYYY-MM-DD'，用於篩選日期範圍)",
                "end_date": "結束日期 (字串，格式: 'YYYY-MM-DD'，用於篩選日期範圍)",
                "is_completed": "篩選已完成/未完成 (布林值，不提供則返回全部)"
            }
        },
        "create_social_post": {
            "description": "建立社群貼文（不含圖片）。圖片需透過前端另外上傳。寵物標註需要圖片，請告知用戶在上傳圖片後使用標註功能。",
            "required_params": ["user_id", "content"],
            "optional_params": ["location", "hashtags"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "content": "貼文內容 (字串，必填)",
                "location": "地點 (字串，例如: '台北大安森林公園')",
                "hashtags": "標籤 (字串，逗號分隔，例如: '寵物,日常,可愛' 或 '#寵物,#日常')"
            },
            "notes": [
                "此操作只建立貼文結構，不包含圖片",
                "如需標註寵物，必須先上傳圖片後使用圖片標註功能",
                "hashtags 可從參數提供或從 content 中的 #標籤 自動解析"
            ],
            "response_handling": {
                "on_success": "Tool returns {success: true, post_id: X, message: '貼文建立成功！', note: '...'}",
                "tell_user": "貼文建立成功！ + include the note field if present",
                "operations_array": "MUST add operation: {operation_name: 'post_created', operation_data: json.dumps({post_id: X, status: 'pending_images'})}",
                "important": "Do NOT mention post_id or technical details in the reply field. The post_id should ONLY be in operations array for frontend to use."
            },
            "user_responses": {
                "missing_content": "好的！請告訴我貼文的內容是什麼呢？您也可以提供地點或標籤。",
                "want_tag_pets": "標註寵物需要先上傳圖片喔！您可以先建立貼文，之後再使用圖片上傳功能來標註寵物。請問貼文內容是什麼呢？"
            }
        }
    }
    return {
        "operations": operations,
        "total_count": len(operations)
    }


def perform_operation(operation: str, data: Dict) -> Dict:
    try:
        if operation == "add_pet":
            return _add_pet(data)
        elif operation == "update_pet":
            return _update_pet(data)
        elif operation == "add_abnormal_post":
            return _add_abnormal_post(data)
        elif operation == "update_abnormal_post":
            return _update_abnormal_post(data)
        elif operation == "delete_abnormal_post":
            return _delete_abnormal_post(data)
        elif operation == "create_disease_archive":
            return _create_disease_archive(data)
        elif operation == "add_plan":
            return _add_plan(data)
        elif operation == "update_plan":
            return _update_plan(data)
        elif operation == "delete_plan":
            return _delete_plan(data)
        elif operation == "list_plans":
            return _list_plans(data)
        elif operation == "create_social_post":
            return _create_social_post(data)
        else:
            return {"error": f"Operation '{operation}' is not implemented"}
    except Exception as e:
        return {"error": f"Failed to perform operation: {str(e)}"}


def _add_pet(data: Dict) -> Dict:
    # 驗證必要欄位
    required_fields = ["user_id", "pet_name", "pet_type", "weight", "pet_stage"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 獲取用戶
    try:
        owner = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 創建寵物
    pet = Pet.objects.create(
        owner=owner,
        pet_name=data["pet_name"],
        pet_type=data["pet_type"],
        weight=data["weight"],
        pet_stage=data["pet_stage"],
        age=data.get("age"),
        breed=data.get("breed"),
        predicted_adult_weight=data.get("predicted_adult_weight"),
        description=data.get("description"),
        height=data.get("height"),
        weeks_of_lactation=data.get("weeks_of_lactation")
    )
    
    return {
        "success": True,
        "message": f"Pet '{pet.pet_name}' created successfully",
        "pet_id": pet.id,
        "pet_data": {
            "id": pet.id,
            "pet_name": pet.pet_name,
            "pet_type": pet.pet_type,
            "weight": pet.weight,
            "pet_stage": pet.pet_stage,
            "breed": pet.breed,
            "age": pet.age
        }
    }


def _update_pet(data: Dict) -> Dict:
    """
    更新寵物資訊
    
    Args:
        data: 包含更新資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    if "pet_id" not in data:
        return {"error": "Missing required field: pet_id"}
    
    # 獲取寵物
    try:
        pet = Pet.objects.get(id=data["pet_id"])
    except Pet.DoesNotExist:
        return {"error": f"Pet with id {data['pet_id']} not found"}
    
    # 更新寵物資訊
    owner = None
    if "owner" in data:
        try:
            owner = CustomUser.objects.get(id=data["owner"])
        except CustomUser.DoesNotExist:
            return {"error": f"User with id {data['owner']} not found"}
    
    pet.update(
        owner=owner,
        weight=data.get("weight"),
        pet_stage=data.get("pet_stage"),
        age=data.get("age"),
        pet_name=data.get("pet_name"),
        breed=data.get("breed"),
        pet_type=data.get("pet_type"),
        predicted_adult_weight=data.get("predicted_adult_weight"),
        description=data.get("description")
    )
    
    # 重新獲取更新後的寵物
    pet.refresh_from_db()
    
    return {
        "success": True,
        "message": f"Pet '{pet.pet_name}' updated successfully",
        "pet_id": pet.id,
        "pet_data": {
            "id": pet.id,
            "pet_name": pet.pet_name,
            "pet_type": pet.pet_type,
            "weight": pet.weight,
            "pet_stage": pet.pet_stage,
            "breed": pet.breed,
            "age": pet.age,
            "description": pet.description
        }
    }


@transaction.atomic
def _add_abnormal_post(data: Dict) -> Dict:
    """
    新增異常記錄
    
    Args:
        data: 包含異常記錄資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "pet_id", "symptoms"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 獲取寵物並驗證所有權
    try:
        pet = Pet.objects.get(id=data["pet_id"], owner=user)
    except Pet.DoesNotExist:
        return {"error": f"Pet with id {data['pet_id']} not found or does not belong to user"}
    
    # 驗證症狀
    symptoms = data.get("symptoms", [])
    if not symptoms or not isinstance(symptoms, list):
        return {"error": "Symptoms must be a non-empty list"}
    
    # 處理記錄日期
    record_date = None
    if data.get("record_date"):
        try:
            record_date = datetime.fromisoformat(data["record_date"].replace('Z', '+00:00'))
            
            # 檢查該日期是否已有記錄
            date_start = record_date.replace(hour=0, minute=0, second=0, microsecond=0)
            date_end = record_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            existing_post = AbnormalPost.objects.filter(
                pet=pet,
                record_date__range=(date_start, date_end)
            ).first()
            
            if existing_post:
                return {
                    "error": f"Pet already has an abnormal post on {record_date.strftime('%Y-%m-%d')}. Only one post per day per pet is allowed."
                }
        except ValueError as e:
            return {"error": f"Invalid date format: {str(e)}"}
    
    # 建立異常記錄
    abnormal_post = AbnormalPost.objects.create(
        pet=pet,
        user=user,
        content=data.get("content", ""),
        weight=float(data["weight"]) if data.get("weight") else None,
        body_temperature=float(data["body_temperature"]) if data.get("body_temperature") else None,
        water_amount=int(data["water_amount"]) if data.get("water_amount") else None,
        is_emergency=data.get("is_emergency", False),
        record_date=record_date,
        is_private=data.get("is_private", True)
    )
    
    # 新增症狀關聯
    symptoms_added = []
    symptoms_not_found = []
    
    for symptom_text in symptoms:
        if isinstance(symptom_text, str) and symptom_text.strip():
            symptom_name = symptom_text.strip()
            
            # 查找現有症狀
            symptom = Symptom.objects.filter(symptom_name=symptom_name).first()
            
            if symptom:
                PostSymptomsRelation.objects.get_or_create(
                    post=abnormal_post,
                    symptom=symptom
                )
                symptoms_added.append(symptom_name)
            else:
                symptoms_not_found.append(symptom_name)
    
    # 準備回傳資料
    result = {
        "success": True,
        "message": f"Abnormal post created successfully for pet '{pet.pet_name}'",
        "note": "如需上傳圖片記錄寵物狀況，請在異常記錄建立後使用圖片上傳功能。",
        "abnormal_post_id": abnormal_post.id,
        "post_data": {
            "id": abnormal_post.id,
            "pet_id": pet.id,
            "pet_name": pet.pet_name,
            "content": abnormal_post.content,
            "weight": abnormal_post.weight,
            "body_temperature": abnormal_post.body_temperature,
            "water_amount": abnormal_post.water_amount,
            "is_emergency": abnormal_post.is_emergency,
            "record_date": abnormal_post.record_date.isoformat() if abnormal_post.record_date else None,
            "is_private": abnormal_post.is_private,
            "created_at": abnormal_post.created_at.isoformat(),
            "symptoms_added": symptoms_added,
            "status": "created_without_images"
        }
    }

    if symptoms_not_found:
        result["warning"] = f"Some symptoms were not found in database: {', '.join(symptoms_not_found)}"

    return result


@transaction.atomic
def _create_disease_archive(data: Dict) -> Dict:
    """
    建立疾病檔案
    
    Args:
        data: 包含疾病檔案資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "pet_id", "archive_title", "content", "abnormal_post_ids"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 驗證資料
    archive_title = data.get("archive_title", "").strip()
    content = data.get("content", "").strip()
    abnormal_post_ids = data.get("abnormal_post_ids", [])
    
    if not archive_title:
        return {"error": "Archive title cannot be empty"}
    
    if not content:
        return {"error": "Archive content cannot be empty"}
    
    if not abnormal_post_ids or not isinstance(abnormal_post_ids, list):
        return {"error": "At least one abnormal post ID is required"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 獲取寵物並驗證所有權
    try:
        pet = Pet.objects.get(id=data["pet_id"], owner=user)
    except Pet.DoesNotExist:
        return {"error": f"Pet with id {data['pet_id']} not found or does not belong to user"}
    
    # 驗證異常記錄是否存在且屬於該用戶的寵物
    abnormal_posts = AbnormalPost.objects.filter(
        id__in=abnormal_post_ids,
        pet=pet,
        user=user
    ).order_by('record_date')
    
    if abnormal_posts.count() != len(abnormal_post_ids):
        return {
            "error": "Some abnormal post IDs are invalid or do not belong to the specified pet and user"
        }
    
    # 建立PostFrame
    post_frame = PostFrame.objects.create(user=user)
    
    # 建立疾病檔案
    disease_archive = DiseaseArchiveContent.objects.create(
        archive_title=archive_title,
        content=content,
        go_to_doctor=data.get("go_to_doctor", False),
        health_status=data.get("health_status", ""),
        pet=pet,
        postFrame=post_frame,
        is_private=data.get("is_private", True)
    )
    
    # 建立異常記錄關聯
    archive_post_relations = []
    for abnormal_post in abnormal_posts:
        archive_post_relations.append(
            ArchiveAbnormalPostRelation(
                archive=disease_archive,
                post=abnormal_post
            )
        )
    ArchiveAbnormalPostRelation.objects.bulk_create(archive_post_relations)
    
    # 處理主要病因
    main_cause = data.get("main_cause", "").strip()
    if main_cause:
        illness, created = Illness.objects.get_or_create(
            illness_name=main_cause
        )
        ArchiveIllnessRelation.objects.create(
            archive=disease_archive,
            illness=illness
        )
    
    logger.info(f"User {user.id} created disease archive {disease_archive.id} for pet {pet.id}")
    
    return {
        "success": True,
        "message": f"Disease archive '{archive_title}' created successfully for pet '{pet.pet_name}'",
        "disease_archive_id": disease_archive.id,
        "archive_data": {
            "id": disease_archive.id,
            "archive_title": disease_archive.archive_title,
            "pet_id": pet.id,
            "pet_name": pet.pet_name,
            "content": disease_archive.content,
            "go_to_doctor": disease_archive.go_to_doctor,
            "health_status": disease_archive.health_status,
            "is_private": disease_archive.is_private,
            "main_cause": main_cause if main_cause else None,
            "included_abnormal_post_ids": list(abnormal_posts.values_list('id', flat=True)),
            "post_frame_id": post_frame.id
        }
    }


@transaction.atomic
def _update_abnormal_post(data: Dict) -> Dict:
    """
    更新異常記錄
    
    Args:
        data: 包含更新資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "post_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 獲取異常記錄並驗證所有權
    try:
        abnormal_post = AbnormalPost.objects.get(
            id=data["post_id"],
            user=user
        )
    except AbnormalPost.DoesNotExist:
        return {"error": f"Abnormal post with id {data['post_id']} not found or does not belong to user"}
    
    # 記錄原始寵物ID
    original_pet_id = abnormal_post.pet.id
    
    # 更新欄位
    update_fields = []
    
    # 如果要更換寵物
    if "pet_id" in data and data["pet_id"]:
        try:
            new_pet = Pet.objects.get(id=data["pet_id"], owner=user)
            abnormal_post.pet = new_pet
            update_fields.append("pet")
        except Pet.DoesNotExist:
            return {"error": f"Pet with id {data['pet_id']} not found or does not belong to user"}
    
    # 更新內容
    if "content" in data:
        abnormal_post.content = data["content"]
        update_fields.append("content")
    
    # 更新體重
    if "weight" in data:
        abnormal_post.weight = float(data["weight"]) if data["weight"] is not None else None
        update_fields.append("weight")
    
    # 更新體溫
    if "body_temperature" in data:
        abnormal_post.body_temperature = float(data["body_temperature"]) if data["body_temperature"] is not None else None
        update_fields.append("body_temperature")
    
    # 更新飲水量
    if "water_amount" in data:
        abnormal_post.water_amount = int(data["water_amount"]) if data["water_amount"] is not None else None
        update_fields.append("water_amount")
    
    # 更新就醫記錄標記
    if "is_emergency" in data:
        abnormal_post.is_emergency = bool(data["is_emergency"])
        update_fields.append("is_emergency")
    
    # 更新隱私設定
    if "is_private" in data:
        abnormal_post.is_private = bool(data["is_private"])
        update_fields.append("is_private")
    
    # 更新記錄日期
    if "record_date" in data and data["record_date"]:
        try:
            record_date = datetime.fromisoformat(data["record_date"].replace('Z', '+00:00'))
            abnormal_post.record_date = record_date
            update_fields.append("record_date")
        except ValueError as e:
            return {"error": f"Invalid date format: {str(e)}"}
    
    # 儲存更新
    if update_fields:
        abnormal_post.save(update_fields=update_fields)
    
    # 更新症狀關聯（如果提供）
    symptoms_updated = False
    symptoms_added = []
    symptoms_not_found = []
    
    if "symptoms" in data and data["symptoms"] is not None:
        symptoms = data["symptoms"]
        
        if not isinstance(symptoms, list):
            return {"error": "Symptoms must be a list"}
        
        # 刪除現有症狀關聯
        PostSymptomsRelation.objects.filter(post=abnormal_post).delete()
        
        # 新增新的症狀關聯
        for symptom_text in symptoms:
            if isinstance(symptom_text, str) and symptom_text.strip():
                symptom_name = symptom_text.strip()
                
                # 查找現有症狀
                symptom = Symptom.objects.filter(symptom_name=symptom_name).first()
                
                if symptom:
                    PostSymptomsRelation.objects.get_or_create(
                        post=abnormal_post,
                        symptom=symptom
                    )
                    symptoms_added.append(symptom_name)
                else:
                    symptoms_not_found.append(symptom_name)
        
        symptoms_updated = True
    
    # 重新獲取更新後的資料
    abnormal_post.refresh_from_db()
    
    # 準備回傳資料
    result = {
        "success": True,
        "message": f"Abnormal post {abnormal_post.id} updated successfully",
        "abnormal_post_id": abnormal_post.id,
        "post_data": {
            "id": abnormal_post.id,
            "pet_id": abnormal_post.pet.id,
            "pet_name": abnormal_post.pet.pet_name,
            "content": abnormal_post.content,
            "weight": abnormal_post.weight,
            "body_temperature": abnormal_post.body_temperature,
            "water_amount": abnormal_post.water_amount,
            "is_emergency": abnormal_post.is_emergency,
            "record_date": abnormal_post.record_date.isoformat() if abnormal_post.record_date else None,
            "is_private": abnormal_post.is_private,
            "updated_at": abnormal_post.updated_at.isoformat()
        }
    }
    
    # 如果更新了症狀，加入症狀資訊
    if symptoms_updated:
        result["post_data"]["symptoms_updated"] = symptoms_added
        if symptoms_not_found:
            result["warning"] = f"Some symptoms were not found in database: {', '.join(symptoms_not_found)}"
    
    # 如果更換了寵物，記錄一下
    if abnormal_post.pet.id != original_pet_id:
        result["note"] = f"Pet changed from ID {original_pet_id} to ID {abnormal_post.pet.id}"
    
    return result


@transaction.atomic
def _delete_abnormal_post(data: Dict) -> Dict:
    """
    刪除異常記錄
    
    Args:
        data: 包含刪除資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "post_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 獲取異常記錄並驗證所有權
    try:
        abnormal_post = AbnormalPost.objects.get(
            id=data["post_id"],
            user=user
        )
    except AbnormalPost.DoesNotExist:
        return {"error": f"Abnormal post with id {data['post_id']} not found or does not belong to user"}
    
    # 記錄一些資訊用於回傳
    pet_name = abnormal_post.pet.pet_name
    record_date = abnormal_post.record_date.strftime('%Y-%m-%d') if abnormal_post.record_date else "Unknown date"
    post_id = abnormal_post.id
    
    # 刪除關聯的圖片（如果有）
    try:
        images = AbnormalPostImage.objects.filter(abnormal_post=abnormal_post)
        image_count = images.count()
        
        # 注意：實際的 Firebase Storage 刪除在這裡不執行，因為需要 firebase_storage_service
        # 這個服務通常在 Django 環境中才能正常使用
        # 如果需要完整的圖片刪除功能，建議在視圖層處理
        
        # 從資料庫刪除圖片記錄
        images.delete()
        logger.info(f"Deleted {image_count} images associated with abnormal post {post_id}")
    except Exception as img_error:
        logger.warning(f"Error deleting images: {str(img_error)}")
        # 繼續執行，不因為圖片刪除失敗而中斷
    
    # 刪除症狀關聯
    PostSymptomsRelation.objects.filter(post=abnormal_post).delete()
    
    # 刪除與疾病檔案的關聯（如果有）
    ArchiveAbnormalPostRelation.objects.filter(post=abnormal_post).delete()
    
    # 刪除異常記錄本身
    abnormal_post.delete()
    
    logger.info(f"User {user.id} deleted abnormal post {post_id}")
    
    return {
        "success": True,
        "message": f"Successfully deleted abnormal post for '{pet_name}' on {record_date}",
        "deleted_post_id": post_id,
        "details": {
            "pet_name": pet_name,
            "record_date": record_date
        }
    }


# ==================== Plan Operations ====================

def _add_plan(data: Dict) -> Dict:
    """
    新增行程
    
    Args:
        data: 包含行程資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "title", "date"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 驗證標題
    title = data.get("title", "").strip()
    if not title:
        return {"error": "Title cannot be empty"}
    
    # 處理日期
    try:
        plan_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Invalid date format. Use 'YYYY-MM-DD' (e.g., '2025-11-15')"}
    
    # 處理時間
    start_time_str = data.get("start_time", "08:00")
    end_time_str = data.get("end_time", "09:00")
    
    try:
        start_time_obj = datetime.strptime(start_time_str, "%H:%M").time()
    except ValueError:
        return {"error": "Invalid start_time format. Use 'HH:MM' (e.g., '14:30')"}
    
    try:
        end_time_obj = datetime.strptime(end_time_str, "%H:%M").time()
    except ValueError:
        return {"error": "Invalid end_time format. Use 'HH:MM' (e.g., '16:00')"}
    
    # 驗證時間邏輯
    if start_time_obj >= end_time_obj:
        return {"error": "Start time must be before end time"}
    
    # 建立行程
    plan = Plan.objects.create(
        user=user,
        title=title,
        description=data.get("description", ""),
        date=plan_date,
        start_time=start_time_obj,
        end_time=end_time_obj,
        is_completed=data.get("is_completed", False)
    )
    
    logger.info(f"User {user.id} created plan {plan.id} for {plan_date}")
    
    return {
        "success": True,
        "message": f"Plan '{title}' created successfully for {plan_date}",
        "plan_id": plan.id,
        "plan_data": {
            "id": plan.id,
            "title": plan.title,
            "description": plan.description,
            "date": plan.date.strftime("%Y-%m-%d"),
            "start_time": plan.start_time.strftime("%H:%M"),
            "end_time": plan.end_time.strftime("%H:%M"),
            "is_completed": plan.is_completed
        }
    }


def _update_plan(data: Dict) -> Dict:
    """
    更新行程
    
    Args:
        data: 包含更新資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "plan_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 獲取行程並驗證所有權
    try:
        plan = Plan.objects.get(id=data["plan_id"], user=user)
    except Plan.DoesNotExist:
        return {"error": f"Plan with id {data['plan_id']} not found or does not belong to user"}
    
    # 更新欄位
    update_fields = []
    
    # 更新標題
    if "title" in data:
        title = data["title"].strip()
        if not title:
            return {"error": "Title cannot be empty"}
        plan.title = title
        update_fields.append("title")
    
    # 更新描述
    if "description" in data:
        plan.description = data["description"]
        update_fields.append("description")
    
    # 更新日期
    if "date" in data:
        try:
            plan.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
            update_fields.append("date")
        except ValueError:
            return {"error": "Invalid date format. Use 'YYYY-MM-DD'"}
    
    # 更新開始時間
    if "start_time" in data:
        try:
            plan.start_time = datetime.strptime(data["start_time"], "%H:%M").time()
            update_fields.append("start_time")
        except ValueError:
            return {"error": "Invalid start_time format. Use 'HH:MM'"}
    
    # 更新結束時間
    if "end_time" in data:
        try:
            plan.end_time = datetime.strptime(data["end_time"], "%H:%M").time()
            update_fields.append("end_time")
        except ValueError:
            return {"error": "Invalid end_time format. Use 'HH:MM'"}
    
    # 驗證時間邏輯（如果兩者都被更新或已存在）
    if plan.start_time >= plan.end_time:
        return {"error": "Start time must be before end time"}
    
    # 更新完成狀態
    if "is_completed" in data:
        plan.is_completed = bool(data["is_completed"])
        update_fields.append("is_completed")
    
    # 儲存更新
    if update_fields:
        plan.save(update_fields=update_fields)
    
    logger.info(f"User {user.id} updated plan {plan.id}")
    
    return {
        "success": True,
        "message": f"Plan '{plan.title}' updated successfully",
        "plan_id": plan.id,
        "plan_data": {
            "id": plan.id,
            "title": plan.title,
            "description": plan.description,
            "date": plan.date.strftime("%Y-%m-%d"),
            "start_time": plan.start_time.strftime("%H:%M"),
            "end_time": plan.end_time.strftime("%H:%M"),
            "is_completed": plan.is_completed
        }
    }


def _delete_plan(data: Dict) -> Dict:
    """
    刪除行程
    
    Args:
        data: 包含刪除資訊的字典
        
    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "plan_id"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {"error": f"Missing required fields: {', '.join(missing_fields)}"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 獲取行程並驗證所有權
    try:
        plan = Plan.objects.get(id=data["plan_id"], user=user)
    except Plan.DoesNotExist:
        return {"error": f"Plan with id {data['plan_id']} not found or does not belong to user"}
    
    # 記錄資訊用於回傳
    plan_id = plan.id
    plan_title = plan.title
    plan_date = plan.date.strftime("%Y-%m-%d")
    
    # 刪除行程
    plan.delete()
    
    logger.info(f"User {user.id} deleted plan {plan_id}")
    
    return {
        "success": True,
        "message": f"Successfully deleted plan '{plan_title}' on {plan_date}",
        "deleted_plan_id": plan_id,
        "details": {
            "title": plan_title,
            "date": plan_date
        }
    }


def _list_plans(data: Dict) -> Dict:
    """
    列出用戶的行程列表
    
    Args:
        data: 包含篩選條件的字典
        
    Returns:
        Dict: 操作結果，包含行程列表
    """
    # 驗證必要欄位
    if "user_id" not in data:
        return {"error": "Missing required field: user_id"}
    
    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}
    
    # 基本查詢
    plans = Plan.objects.filter(user=user)
    
    # 日期範圍篩選
    if "start_date" in data and "end_date" in data:
        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
            plans = plans.filter(date__range=(start_date, end_date))
        except ValueError:
            return {"error": "Invalid date format for start_date or end_date. Use 'YYYY-MM-DD'"}
    elif "start_date" in data:
        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            plans = plans.filter(date__gte=start_date)
        except ValueError:
            return {"error": "Invalid date format for start_date. Use 'YYYY-MM-DD'"}
    elif "end_date" in data:
        try:
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
            plans = plans.filter(date__lte=end_date)
        except ValueError:
            return {"error": "Invalid date format for end_date. Use 'YYYY-MM-DD'"}
    
    # 完成狀態篩選
    if "is_completed" in data:
        plans = plans.filter(is_completed=bool(data["is_completed"]))
    
    # 按日期和開始時間排序
    plans = plans.order_by('date', 'start_time')
    
    # 轉換為字典列表
    plans_data = []
    for plan in plans:
        plans_data.append({
            "id": plan.id,
            "title": plan.title,
            "description": plan.description,
            "date": plan.date.strftime("%Y-%m-%d"),
            "start_time": plan.start_time.strftime("%H:%M"),
            "end_time": plan.end_time.strftime("%H:%M"),
            "is_completed": plan.is_completed
        })
    
    logger.info(f"User {user.id} listed {len(plans_data)} plans")
    
    return {
        "success": True,
        "message": f"Found {len(plans_data)} plan(s)",
        "total_count": len(plans_data),
        "plans": plans_data
    }


# ==================== Social Post Operations ====================

@transaction.atomic
def _create_social_post(data: Dict) -> Dict:
    """
    建立社群貼文（不含圖片）

    Args:
        data: 包含貼文資訊的字典

    Returns:
        Dict: 操作結果
    """
    # 驗證必要欄位
    required_fields = ["user_id", "content"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return {
            "error": "Missing required fields",
            "missing_fields": missing_fields,
            "help": "content (貼文內容) is required"
        }

    # 驗證內容不為空
    content = data.get("content", "").strip()
    if not content:
        return {
            "error": "Content is required and cannot be empty",
            "missing_fields": ["content"]
        }

    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
    except CustomUser.DoesNotExist:
        return {"error": f"User with id {data['user_id']} not found"}

    # 獲取可選參數
    location = data.get("location", "").strip() or None
    hashtags_param = data.get("hashtags", "")

    # 1. 建立 PostFrame
    post_frame = PostFrame.objects.create(user=user)

    # 2. 建立 SoLContent
    sol_content = SoLContent.objects.create(
        postFrame=post_frame,
        content_text=content,
        location=location
    )

    # 3. 解析並建立標籤
    created_hashtags = []

    # 從參數解析標籤
    tag_list = []
    if hashtags_param:
        tag_list = [tag.strip().lstrip('#') for tag in hashtags_param.split(',')]

    # 從內容中提取 #標籤
    implicit_tags = re.findall(r'#([\w\u4e00-\u9fff]+)', content)

    # 合併並去重
    all_tags = list(set(tag_list + implicit_tags))

    for tag in all_tags:
        if tag:  # 確保標籤不為空
            hashtag_obj = PostHashtag.objects.create(
                postFrame=post_frame,
                tag=tag.strip()
            )
            created_hashtags.append(tag)

    # 4. 觸發推薦服務嵌入（可選）
    try:
        from social.apps import SocialConfig
        recommendation_service = SocialConfig.get_recommendation_service()
        if recommendation_service:
            recommendation_service.embed_new_post(
                post_id=post_frame.id,
                content=content,
                content_type="social"
            )
    except Exception as embed_error:
        # 嵌入失敗不影響貼文建立
        logger.warning(f"Failed to embed post for recommendations: {embed_error}")

    logger.info(f"User {user.id} created social post {post_frame.id}")

    return {
        "success": True,
        "message": "貼文建立成功！",
        "note": "如需上傳圖片或標註寵物，請在貼文建立後使用圖片上傳功能。",
        "post_id": post_frame.id,
        "post_frame_id": post_frame.id,
        "status": "created_without_images",
        "post_data": {
            "id": post_frame.id,
            "content": content,
            "location": location,
            "hashtags": created_hashtags,
            "created_at": post_frame.created_at.isoformat(),
            "user": {
                "id": user.id,
                "username": user.username
            }
        }
    }
