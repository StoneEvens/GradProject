from typing import Dict, Literal
from accounts.models import CustomUser
from pets.models import Pet


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
