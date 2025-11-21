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
                "operations_array": "MUST add operation to operations array with EXACT format: {'operation_type': 'abnormal_post_created', 'operation_data': json.dumps({'abnormal_post_id': X, 'pet_id': Y, 'status': 'pending_images'})}. Note: operation_data MUST be a JSON string created with json.dumps().",
                "important": "CRITICAL: Use {'operation_type': ..., 'operation_data': json.dumps({...})} format. Do NOT use {operation_id, type, params} format. Do NOT mention abnormal_post_id or technical details in the reply field. The abnormal_post_id should ONLY be in operations array for frontend to use.",
                "confirmation_marker": "CRITICAL: When displaying final_confirmation_with_images message to user, you MUST add special marker '[[NEEDS_CONFIRMATION_WITH_IMAGES]]' at the END of your reply text. This marker tells frontend to display cached images in AI message bubble. Example: 'Your confirmation message here\n\n[[NEEDS_CONFIRMATION_WITH_IMAGES]]'. This marker will be hidden from user but frontend will detect it."
            },
            "user_responses": {
                "missing_symptoms": "好的！請告訴我寵物出現了哪些症狀呢？",
                "want_upload_images": "異常記錄已建立，您也可以上傳圖片來記錄寵物的狀況喔！",
                "final_confirmation_with_images": "請確認異常記錄資訊：\n\n- 寵物名稱：{pet_name}\n- 症狀：{symptoms}\n- 異常描述：{content}\n- 體重：{weight} 公斤\n- 體溫：{body_temperature} 度\n- 飲水量：{water_amount} 毫升\n- 是否就醫：{is_emergency}\n\n已選擇圖片：{imageCount} 張（請查看下方我展示的圖片）\n\n如果所有資訊和圖片都確認無誤，請回覆「確認」或「是」。",
                "final_confirmation_without_images": "請確認異常記錄資訊：\n\n- 寵物名稱：{pet_name}\n- 症狀：{symptoms}\n- 異常描述：{content}\n- 體重：{weight} 公斤\n- 體溫：{body_temperature} 度\n- 飲水量：{water_amount} 毫升\n- 是否就醫：{is_emergency}\n\n如果資訊正確，請回覆「確認」或「是」。"
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
            "description": "建立社群貼文（不含圖片）。【強制規則】1) 社群貼文必須包含至少一張圖片！檢查 context.hasImages 和 context.imageCount，如果為 false/0 則不呼叫此工具。2) 在呼叫此工具前，必須先向用戶顯示完整的貼文預覽（內容、地點、標籤、圖片數量）並明確詢問「確認發布嗎？」等待用戶明確回覆（如「確認」、「是」、「好」、「發布」）後才呼叫此工具。3)不准自作主張詢問用戶 required_params 和 optional_params 以外的要素。4)非所有貼文是否公開是由使用者帳號隱私設定決定，你不用管。",
            "required_params": ["user_id", "content", "has_images"],
            "optional_params": ["location", "hashtags"],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "content": "貼文內容 (字串，必填)",
                "has_images": "用戶是否已選擇圖片 (布林值，必填且必須為 true)。從 context.hasImages 或 context.imageCount 判斷。如果為 false 或 0，不要呼叫此工具，必須先提示用戶選擇圖片！",
                "location": "地點 (字串，例如: '台北大安森林公園')",
                "hashtags": "標籤 (字串，逗號分隔，例如: '寵物,日常,可愛' 或 '#寵物,#日常')"
            },
            "FORBIDDEN_params": {
                "visibility": "此參數不存在！所有貼文自動為公開，絕對不要詢問或嘗試設定此參數",
                "privacy": "此參數不存在！絕對不要詢問隱私設定",
                "is_public": "此參數不存在！貼文永遠是公開的",
                "is_private": "此參數不存在！",
                "scope": "此參數不存在！",
                "pet_tags": "此參數不存在！不支援標註寵物",
                "tagged_pets": "此參數不存在！",
                "comment_enabled": "此參數不存在！",
                "images": "此參數不存在！圖片由前端另外上傳，不要在此工具中處理"
            },
            "notes": [
                "【最重要規則 1】呼叫此工具前必須先檢查 context.hasImages 和 context.imageCount！",
                "【最重要規則 2】呼叫此工具前必須先向用戶顯示完整預覽並等待明確確認！",
                "如果 hasImages=false 或 imageCount=0，絕對不要呼叫此工具！",
                "必須先用 user_responses.missing_images 提示用戶選擇圖片！",
                "收集完所有資訊後，使用 user_responses.final_confirmation 顯示預覽並詢問確認",
                "等待用戶明確回覆「確認」、「是」、「好」、「發布」等確認詞彙",
                "只有在用戶明確確認後才呼叫此工具",
                "此操作只建立貼文結構，不包含圖片",
                "相片上傳由前端處理，只支援相片不支援影片",
                "hashtags 可從參數提供或從 content 中的 #標籤 自動解析",
                "所有貼文都是公開的，沒有可見範圍設定功能"
            ],
            "limitations": [
                "【強制限制】所有社群貼文都必須包含至少一張圖片，沒有圖片絕對不能發布貼文",
                "絕對不要詢問可見範圍（如「公開」、「好友」或「私密」）- 系統不支援此功能，所有貼文都是公開的",
                "不支援標註寵物功能",
                "不支援設定留言權限或互動設定",
                "不支援影片上傳，只支援相片"
            ],
            "response_handling": {
                "on_success": "Tool returns {success: true, post_id: X, message: '貼文建立成功！', note: '...'}",
                "on_missing_images": "Tool returns {error: '...', user_message: '發布社群貼文需要至少一張圖片。請先點擊聊天框左下角的相片按鈕選擇圖片，然後再告訴我發布貼文。', should_ask_user: true}. You MUST use the user_message in your reply to guide the user.",
                "tell_user": "回覆格式：「貼文建立成功！\n\n內容：[content]\n地點：[location]\n標籤：[hashtags]\n\n您可以點擊下方按鈕前往貼文頁面，並標註寵物。」圖片已由前端自動上傳，不要提及圖片上傳。",
                "operations_array": "MUST add operation to operations array with EXACT format: {'operation_type': 'post_created', 'operation_data': json.dumps({'post_id': X, 'status': 'pending_images'})}. Note: operation_data MUST be a JSON string created with json.dumps().",
                "important": "CRITICAL: Use {'operation_type': ..., 'operation_data': json.dumps({...})} format. Do NOT use {operation_id, type, params} format. Do NOT mention post_id or technical details in the reply field. The post_id should ONLY be in operations array for frontend to use. Do NOT mention uploading photos - photos are handled by frontend automatically.",
                "confirmation_marker": "CRITICAL: When displaying final_confirmation message to user (using final_confirmation template), you MUST add special marker '[[NEEDS_CONFIRMATION_WITH_IMAGES]]' at the END of your reply text. This marker tells frontend to display cached images in AI message bubble. Example: 'Your confirmation message here\n\n[[NEEDS_CONFIRMATION_WITH_IMAGES]]'. This marker will be hidden from user but frontend will detect it."
            },
            "user_responses": {
                "missing_content": "好的！請告訴我：\n\n1. 貼文要寫什麼內容呢？\n2. 要標註地點嗎？（例如：台北大安森林公園）\n3. 要加上標籤嗎？（例如：#寵物日常 #可愛）\n\n另外，社群貼文一定要有圖片喔！請先點擊聊天框左下角的相片按鈕選擇要上傳的圖片。",
                "missing_images": "社群貼文一定要包含圖片才能發布！\n\n請先點擊聊天框左下角的相片按鈕選擇圖片，然後再告訴我發布貼文。",
                "final_confirmation": "請確認您的貼文資訊：\n\n內容：{content}\n\n地點：{location}\n\n標籤：{hashtags}\n\n已選擇圖片：{imageCount} 張（請查看下方我展示的圖片）\n\n如果所有資訊和圖片都確認無誤，請回覆「確認」、「是」或「發布」。",
                "ask_guidance": "重要規則：\n1. 檢查 context.hasImages 和 context.imageCount\n2. 如果 hasImages=false 或 imageCount=0，必須使用 missing_images 回應\n3. 絕對不要在沒有圖片時呼叫 create_social_post 工具\n4. 收集完所有資訊後，使用 final_confirmation 模板向用戶展示完整預覽\n5. 明確提示用戶查看圖片預覽區域\n6. 等待用戶明確確認（「確認」、「是」、「好」、「發布」等）後才呼叫 create_social_post 工具\n\n以口語化方式詢問以下資訊：\n1）貼文內容（必需，用「貼文要寫什麼內容」而非「content」）\n2）地點（可選，用「要標註地點嗎」而非「location」）\n3）標籤（可選，用「要加上標籤嗎」或「hashtags」都可以）\n4）圖片（必需！必須提醒選擇圖片）\n\n絕對不要：\n- 在沒有圖片（hasImages=false）時呼叫 create_social_post\n- 在用戶未明確確認前呼叫 create_social_post\n- 提及 user_id、post_id 等技術術語\n- 詢問 media_urls（這不存在，只需提醒用戶選擇圖片）\n- 詢問可見範圍、隱私設定、留言權限、寵物標註（系統不支援）\n- 使用原始變數名稱與用戶對話\n- 使用表情符號"
            }
        },
        "add_feed": {
            "description": "新增飼料資料（包含完整資訊和營養成分）。重要：此操作必須在用戶明確確認所有資訊後才執行！請先向用戶顯示完整的飼料資訊（包括所有營養成分），並明確詢問「資訊正確嗎？」等待用戶回覆確認後再呼叫此工具。圖片由前端另外上傳。系統具備智能匹配功能，會自動檢查資料庫中是否已存在相同營養成分的飼料。",
            "required_params": ["user_id", "pet_type", "has_images", "name", "brand", "price"],
            "optional_params": [
                "protein", "fat", "carbohydrate",
                "calcium", "phosphorus", "magnesium", "sodium"
            ],
            "param_details": {
                "user_id": "用戶ID (整數)",
                "pet_type": "適用寵物類型 (字串: 'dog' 或 'cat')",
                "has_images": "用戶是否已選擇圖片 (布林值，從上下文判斷。必須是 2 張圖片：包裝照片和營養標示照片)",
                "name": "飼料名稱 (字串)",
                "brand": "品牌 (字串)",
                "price": "價格 (浮點數)",
                "protein": "蛋白質 (浮點數，%)",
                "fat": "脂肪 (浮點數，%)",
                "carbohydrate": "碳水化合物/纖維 (浮點數，%)",
                "calcium": "鈣 (浮點數，%)",
                "phosphorus": "磷 (浮點數，%)",
                "magnesium": "鎂 (浮點數，%)",
                "sodium": "鈉 (浮點數，%)"
            },
            "FORBIDDEN_params": {
                "visibility": "此參數不存在",
                "privacy": "此參數不存在",
                "is_public": "此參數不存在",
                "is_private": "此參數不存在"
            },
            "notes": [
                "此操作建立完整的飼料記錄（包含營養成分）",
                "圖片需透過前端另外上傳",
                "必須在用戶確認所有資訊後才呼叫此操作",
                "營養成分來自 OCR 辨識",
                "【重要】所有營養成分參數都是必填的：protein, fat, carbohydrate, calcium, phosphorus, magnesium, sodium",
                "如果 OCR 未辨識出某個營養成分，其值會自動為 0（前端已處理），請直接使用 ocrData 中的所有值",
                "絕對不要省略任何營養成分參數，也不要發明數值，直接使用 ocrData 提供的值",
                "【智能匹配】系統會根據所有營養成分（protein, fat, carbohydrate, calcium, phosphorus, magnesium, sodium）檢查是否已存在相同的飼料",
                "如果匹配到已存在的飼料，會回傳 is_existing=true，此時不需要上傳圖片，直接結束流程"
            ],
            "response_handling": {
                "on_success_new": "Tool returns {success: true, feed_id: X, is_existing: false, message: '飼料建立成功！'}",
                "on_success_matched": "Tool returns {success: true, feed_id: X, is_existing: true, matched_feed: {...}, navigation: {path: '/feeds/{id}', destination: '飼料詳情頁面'}, message: '資料庫中已有符合的飼料：品牌 - 名稱'}",
                "tell_user_new": "飼料資料建立成功！正在上傳圖片...",
                "tell_user_matched": "已找到資料庫中符合的飼料：[品牌] - [名稱]。您可以點擊下方按鈕前往查看飼料詳情。",
                "operations_array_new": "MUST add operation to operations array with EXACT format: {'operation_type': 'feed_created', 'operation_data': json.dumps({'feed_id': X, 'is_existing': False, 'status': 'pending_images'})}. Note: operation_data MUST be a JSON string created with json.dumps().",
                "operations_array_matched": "MUST add TWO operations to operations array: 1) {'operation_type': 'feed_created', 'operation_data': json.dumps({'feed_id': X, 'is_existing': True, 'status': 'matched'})} AND 2) {'operation_type': 'navigate', 'operation_data': json.dumps({'path': '/feeds/{id}', 'destination': '飼料詳情頁面'})}. Both operation_data MUST be JSON strings.",
                "important": "CRITICAL: Use {'operation_type': ..., 'operation_data': json.dumps({...})} format. Do NOT use {operation_id, type, params, requires_confirmation} format - frontend will convert automatically. Do NOT mention feed_id in reply field. Only in operations array. When is_existing=true, add BOTH feed_created AND navigate operations so user can navigate to the matched feed.",
                "confirmation_marker": "CRITICAL: When displaying final_confirmation message to user (using final_confirmation template), you MUST add special marker '[[NEEDS_CONFIRMATION_WITH_IMAGES]]' at the END of your reply text. This marker tells frontend to display cached images in AI message bubble. Example: 'Your confirmation message here\n\n[[NEEDS_CONFIRMATION_WITH_IMAGES]]'. This marker will be hidden from user but frontend will detect it."
            },
            "user_responses": {
                "missing_images": "新增飼料需要上傳 2 張圖片。請先點擊聊天框左下角的相片按鈕選擇：\n1. 飼料包裝正面照片\n2. 營養標示照片（成分表）",
                "ask_pet_type": "請問這是狗的飼料還是貓的飼料？",
                "ask_name_brand": "請告訴我飼料的品牌和名稱（如果您知道的話）",
                "show_ocr_results_and_confirm": "營養成分辨識完成！\n\n辨識結果：\n- 蛋白質：{protein}%\n- 脂肪：{fat}%\n- 碳水化合物/纖維：{carbohydrate}%\n- 鈣：{calcium}%、磷：{phosphorus}%、鎂：{magnesium}%、鈉：{sodium}%\n\n請問這是狗的飼料還是貓的飼料？另外請告訴我品牌和名稱。",
                "final_confirmation": "請確認飼料資訊：\n\n- 適用對象：{pet_type_zh}\n- 品牌：{brand}\n- 名稱：{name}\n- 價格：{price} 元\n- 蛋白質：{protein}%\n- 脂肪：{fat}%\n- 碳水化合物：{carbohydrate}%\n- 鈣：{calcium}%、磷：{phosphorus}%、鎂：{magnesium}%、鈉：{sodium}%\n\n已選擇圖片：2 張（請查看下方我展示的圖片：包裝照片和營養標示照片）\n\n如果所有資訊和圖片都確認無誤，請回覆「確認」或「是」。如果需要修改，請告訴我要修改哪些部分。",
                "created_new": "飼料資料建立成功！正在上傳圖片...",
                "matched_existing": "已找到資料庫中符合的飼料：[品牌] - [名稱]。您可以直接使用這筆資料，無需重複建立。"
            },
            "workflow": [
                "【重要】完整工作流程，每個步驟都必須執行：",
                "1. 用戶選擇圖片 → 確認 has_images=true 且 imageCount=2",
                "2. 呼叫 prepare_feed_ocr() 並在 operations array 加入 ocr_feed_analysis",
                "3. 告訴用戶：「收到圖片！正在辨識飼料資訊，請稍候...」",
                "4. 等待前端回傳 OCR 結果（ocrCompleted=true, ocrData 包含所有營養成分）",
                "5. 收到 OCR 結果後，使用 show_ocr_results_and_confirm 模板顯示完整辨識結果並詢問 pet_type, name, brand",
                "6. 收集 pet_type, name, brand 後，使用 final_confirmation 模板顯示完整資訊並明確詢問「資訊正確嗎？」",
                "7. 【關鍵】等待用戶明確確認（例如回覆「確認」、「是」、「正確」、「沒問題」等）",
                "8. 用戶確認後才呼叫 perform_database_operation('add_feed', {...完整資料...})",
                "9a. 如果 is_existing=false：告知「飼料資料建立成功！正在上傳圖片...」，前端會自動上傳",
                "9b. 如果 is_existing=true：告知已匹配到現有飼料，加入 navigate operation"
            ]
        }
    }
    return {
        "operations": operations,
        "total_count": len(operations)
    }


def perform_operation(operation: str, data: Dict) -> Dict:
    try:
        logger.info(f"[perform_operation] Starting operation: {operation}")
        logger.debug(f"[perform_operation] Data: {data}")

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
            result = _create_social_post(data)
            logger.info(f"[perform_operation] create_social_post result: success={result.get('success')}")
            return result
        elif operation == "add_feed":
            logger.info(f"[perform_operation] ===== STARTING add_feed =====")
            logger.info(f"[perform_operation] add_feed data: {data}")
            result = _add_feed(data)
            logger.info(f"[perform_operation] add_feed result: {result}")
            logger.info(f"[perform_operation] ===== FINISHED add_feed =====")
            return result
        else:
            error_msg = f"Operation '{operation}' is not implemented"
            logger.error(f"[perform_operation] {error_msg}")
            return {"error": error_msg}
    except Exception as e:
        error_msg = f"Failed to perform operation: {str(e)}"
        logger.error(f"[perform_operation] Exception: {error_msg}", exc_info=True)
        return {"error": error_msg}


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
    logger.info(f"[_create_social_post] Starting with data: user_id={data.get('user_id')}, content_length={len(data.get('content', ''))}, has_images={data.get('has_images')}")

    # 驗證必要欄位
    required_fields = ["user_id", "content", "has_images"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        logger.warning(f"[_create_social_post] Missing fields: {missing_fields}")
        return {
            "error": "Missing required fields",
            "missing_fields": missing_fields,
            "help": "user_id, content, and has_images are required"
        }

    # 驗證內容不為空
    content = data.get("content", "").strip()
    if not content:
        logger.warning(f"[_create_social_post] Content is empty")
        return {
            "error": "Content is required and cannot be empty",
            "missing_fields": ["content"]
        }

    # 檢查用戶是否已選擇圖片（社群貼文必須帶圖片）
    has_images = data.get("has_images")
    if not has_images:
        logger.warning(f"[_create_social_post] User has not selected images")
        return {
            "error": "社群貼文必須包含圖片",
            "user_message": "發布社群貼文需要至少一張圖片。請先點擊聊天框左下角的相片按鈕選擇圖片，然後再告訴我發布貼文。",
            "should_ask_user": True
        }

    # 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        logger.debug(f"[_create_social_post] Found user: {user.username}")
    except CustomUser.DoesNotExist:
        logger.error(f"[_create_social_post] User {data['user_id']} not found")
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


# ==================== Feed Operations ====================

@transaction.atomic
def _add_feed(data: Dict) -> Dict:
    """
    建立飼料記錄（包含完整資訊和營養成分）

    此函數應在用戶確認所有資訊（包含 OCR 結果）後才被呼叫

    Args:
        data: 包含飼料資訊的字典

    Returns:
        Dict: 操作結果
    """
    logger.info(f"[_add_feed] Creating feed with complete data: user_id={data.get('user_id')}, pet_type={data.get('pet_type')}")

    # 1. 驗證必要欄位
    required_fields = ["user_id", "pet_type", "has_images", "name", "brand", "price"]
    missing_fields = [f for f in required_fields if f not in data or data.get(f) is None or data.get(f) == ""]
    if missing_fields:
        logger.warning(f"[_add_feed] Missing fields: {missing_fields}")
        # 產生友善的錯誤訊息
        field_names = {
            "user_id": "用戶ID",
            "pet_type": "寵物類型",
            "has_images": "圖片",
            "name": "飼料名稱",
            "brand": "品牌",
            "price": "價格"
        }
        missing_names = [field_names.get(f, f) for f in missing_fields]
        return {
            "error": "Missing required fields",
            "missing_fields": missing_fields,
            "user_message": f"請提供以下資訊：{', '.join(missing_names)}",
            "help": "name, brand, price 為必填欄位"
        }

    # 2. 檢查是否有圖片
    has_images = data.get("has_images")
    if not has_images:
        logger.warning(f"[_add_feed] User has not selected images")
        return {
            "error": "飼料必須包含圖片",
            "user_message": "新增飼料需要上傳圖片。請先點擊聊天框左下角的相片按鈕選擇：\n1. 飼料包裝正面照片\n2. 營養標示照片（成分表）",
            "should_ask_user": True
        }

    # 3. 驗證 pet_type
    pet_type = data.get("pet_type", "").lower()
    if pet_type not in ['dog', 'cat']:
        logger.warning(f"[_add_feed] Invalid pet_type: {pet_type}")
        return {
            "error": "Invalid pet_type",
            "user_message": "請指定寵物類型為「狗」或「貓」。"
        }

    # 4. 獲取用戶
    try:
        user = CustomUser.objects.get(id=data["user_id"])
        logger.debug(f"[_add_feed] Found user: {user.username}")
    except CustomUser.DoesNotExist:
        logger.error(f"[_add_feed] User {data['user_id']} not found")
        return {"error": f"User with id {data['user_id']} not found"}

    # 5. 解析營養成分（OCR 提供，若為 None 則設為 0）
    def parse_float(value):
        """將值轉換為浮點數，None 或無效值轉為 0.0"""
        if value is None or value == "":
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    protein = parse_float(data.get("protein"))
    fat = parse_float(data.get("fat"))
    carbohydrate = parse_float(data.get("carbohydrate"))
    calcium = parse_float(data.get("calcium"))
    phosphorus = parse_float(data.get("phosphorus"))
    magnesium = parse_float(data.get("magnesium"))
    sodium = parse_float(data.get("sodium"))

    # 6. 獲取必填資訊（已在步驟 1 驗證存在）
    name = data.get("name").strip()
    brand = data.get("brand").strip()
    price = parse_float(data.get("price"))

    # 7. 智能匹配：先檢查 brand+name+pet_type，再檢查營養成分
    from feeds.models import Feed

    # 7.1 優先檢查：是否已存在相同 brand+name+pet_type 的飼料（避免 unique_together 衝突）
    existing_by_identity = Feed.objects.filter(
        name=name,
        brand=brand,
        pet_type=pet_type
    ).first()

    if existing_by_identity:
        logger.info(f"[_add_feed] Found existing feed by identity {existing_by_identity.id}: {existing_by_identity.brand} - {existing_by_identity.name}")
        return {
            "success": True,
            "message": f"資料庫中已有此飼料：{existing_by_identity.brand} - {existing_by_identity.name}",
            "feed_id": existing_by_identity.id,
            "is_existing": True,
            "matched_feed": {
                "id": existing_by_identity.id,
                "name": existing_by_identity.name,
                "brand": existing_by_identity.brand,
                "pet_type": existing_by_identity.pet_type,
                "protein": existing_by_identity.protein,
                "fat": existing_by_identity.fat,
                "carbohydrate": existing_by_identity.carbohydrate,
                "calcium": existing_by_identity.calcium,
                "phosphorus": existing_by_identity.phosphorus,
                "magnesium": existing_by_identity.magnesium,
                "sodium": existing_by_identity.sodium,
                "price": existing_by_identity.price
            },
            "navigation": {
                "path": f"/feeds/{existing_by_identity.id}",
                "destination": "飼料詳情頁面"
            },
            "note": "已找到相同品牌和名稱的飼料。"
        }

    # 7.2 次要檢查：是否已存在相同營養成分的飼料
    existing_by_nutrition = Feed.objects.filter(
        pet_type=pet_type,
        protein=protein,
        fat=fat,
        carbohydrate=carbohydrate,
        calcium=calcium,
        phosphorus=phosphorus,
        magnesium=magnesium,
        sodium=sodium
    ).first()

    if existing_by_nutrition:
        logger.info(f"[_add_feed] Matched existing feed by nutrition {existing_by_nutrition.id}: {existing_by_nutrition.brand} - {existing_by_nutrition.name}")
        return {
            "success": True,
            "message": f"資料庫中已有營養成分相同的飼料：{existing_by_nutrition.brand} - {existing_by_nutrition.name}",
            "feed_id": existing_by_nutrition.id,
            "is_existing": True,
            "matched_feed": {
                "id": existing_by_nutrition.id,
                "name": existing_by_nutrition.name,
                "brand": existing_by_nutrition.brand,
                "pet_type": existing_by_nutrition.pet_type,
                "protein": existing_by_nutrition.protein,
                "fat": existing_by_nutrition.fat,
                "carbohydrate": existing_by_nutrition.carbohydrate,
                "calcium": existing_by_nutrition.calcium,
                "phosphorus": existing_by_nutrition.phosphorus,
                "magnesium": existing_by_nutrition.magnesium,
                "sodium": existing_by_nutrition.sodium,
                "price": existing_by_nutrition.price
            },
            "navigation": {
                "path": f"/feeds/{existing_by_nutrition.id}",
                "destination": "飼料詳情頁面"
            },
            "note": "已智能匹配到營養成分相同的現有飼料。"
        }

    # 8. 建立新的 Feed 記錄（如果沒有匹配到）
    feed = Feed.objects.create(
        pet_type=pet_type,
        name=name,
        brand=brand,
        price=price,
        created_by=user,
        # 營養成分（來自 OCR）
        protein=protein,
        fat=fat,
        carbohydrate=carbohydrate,
        calcium=calcium,
        phosphorus=phosphorus,
        magnesium=magnesium,
        sodium=sodium
    )

    logger.info(f"User {user.id} created feed {feed.id}: {feed.brand} - {feed.name}")

    return {
        "success": True,
        "message": f"飼料「{feed.brand} - {feed.name}」建立成功！",
        "feed_id": feed.id,
        "is_existing": False,
        "status": "pending_images",
        "note": "圖片正在上傳中..."
    }
