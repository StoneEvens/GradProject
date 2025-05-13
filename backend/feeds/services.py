import math

def calculate_rer(weight_kg):
    """
    計算寵物的靜止能量需求 (Resting Energy Requirement, RER) kcal/day。
    公式: RER = 70 * (體重kg ^ 0.75)
    """
    if not isinstance(weight_kg, (int, float)) or weight_kg <= 0:
        raise ValueError("寵物體重必須是正數。")
    return 70 * (weight_kg ** 0.75)

def calculate_der(pet_info):
    """
    計算寵物的每日能量需求 (Daily Energy Requirement, DER) kcal/day。
    pet_info 是一個包含以下鍵的字典:
    - 'weight_kg': 寵物體重 (公斤)
    - 'pet_type': 'dog' 或 'cat'
    - 'pet_stage': 例如 'adult', 'puppy', 'kitten_0_4', 'kitten_4_12', 'pregnant', 'lactating', 'senior', 'inactive', 'active', 'weight_loss', 'weight_gain'
    - 'is_spayed_neutered': True 或 False (可選，主要影響成年貓狗的基礎因子)
    - 'activity_level': (可選, 例如 'low', 'moderate', 'high') 
    """
    weight_kg = pet_info.get('weight_kg')
    pet_type = pet_info.get('pet_type')
    pet_stage = pet_info.get('pet_stage')
    is_spayed_neutered = pet_info.get('is_spayed_neutered', False) # 默認為未絕育

    if weight_kg is None or pet_type is None or pet_stage is None:
        raise ValueError("缺少必要的寵物信息：體重、類型或階段。")

    rer = calculate_rer(weight_kg)
    der_factor = 1.0  # 預設因子

    if pet_type == 'dog':
        if pet_stage == 'adult':
            der_factor = 1.6 if is_spayed_neutered else 1.8
        elif pet_stage == 'puppy_0_4': # 幼犬 (0-4 個月)
            der_factor = 3.0
        elif pet_stage == 'puppy_4_adult': # 幼犬 (4 個月至成年)
            der_factor = 2.0
        elif pet_stage == 'weight_loss':
            der_factor = 1.0 # 基於理想體重
        elif pet_stage == 'weight_gain':
            der_factor = 1.2 # 到 1.4，取決於目標體重和品種
        elif pet_stage == 'active' or pet_stage == 'working_light':
            der_factor = 2.0
        elif pet_stage == 'working_moderate':
            der_factor = 3.0
        elif pet_stage == 'working_heavy':
            der_factor = 4.0 # 可高達 8.0
        elif pet_stage == 'pregnant_first_half':
             der_factor = 1.8 # 維持
        elif pet_stage == 'pregnant_last_half':
             der_factor = 3.0
        elif pet_stage == 'lactating': # 泌乳期，依幼犬數量和週數
            der_factor = 4.0 # 可高至 8.0
        elif pet_stage == 'senior':
            der_factor = 1.4 # 減少 20% 左右，因子約 1.4
        # 可以根據 activity_level 微調成年犬的因子
        # 例如 if pet_info.get('activity_level') == 'high' and pet_stage == 'adult': der_factor *= 1.2

    elif pet_type == 'cat':
        if pet_stage == 'kitten_0_4' or pet_stage == 'kitten': # 幼貓 (0-4個月或統稱幼貓)
            der_factor = 2.5 # 有些來源是 3.0
        elif pet_stage == 'kitten_4_12': # 幼貓 (4-12個月)
            der_factor = 2.0
        elif pet_stage == 'adult':
            der_factor = 1.2 if is_spayed_neutered else 1.4
            activity = pet_info.get('activity_level', 'moderate')
            if activity == 'inactive' or activity == 'prone_to_obesity':
                der_factor = 1.0
            elif activity == 'active':
                der_factor = 1.6
        elif pet_stage == 'pregnant':
            der_factor = 2.0 # 逐漸增加
        elif pet_stage == 'lactating':
            der_factor = 2.0 # 可高達 5.0，依幼貓數量
        elif pet_stage == 'senior': # 老貓 (7歲+)
            der_factor = 1.1 # 到 1.4，若活躍
        elif pet_stage == 'weight_loss':
            der_factor = 0.8 # 基於理想體重
        elif pet_stage == 'weight_gain':
            der_factor = 1.2 # 到 1.8，基於理想體重
    else:
        raise ValueError(f"未知的寵物類型: {pet_type}")

    return rer * der_factor 