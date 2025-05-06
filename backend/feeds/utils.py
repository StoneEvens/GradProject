import re
import logging

# 配置日誌記錄器
logger = logging.getLogger(__name__)

def extract_nutrition_info_for_chinese(text):
    """
    從文本中提取營養信息
    支持中文營養標籤解析
    
    返回：
    - 提取的營養信息字典
    - 警告列表（如有異常值或可能的誤讀）
    """
    text = text.lower()
    warnings = []
    
    # 初始化營養信息
    nutrition_info = {
        'protein': 0,
        'fat': 0,
        'calcium': 0,
        'phosphorus': 0,
        'magnesium': 0,
        'sodium': 0,
        'carbohydrate': 0,
    }
    
    # 中文關鍵詞映射
    cn_terms = {
        'protein': ['蛋白質', '蛋白质', '粗蛋白', '總蛋白', '总蛋白'],
        'fat': ['脂肪', '粗脂肪', '總脂肪', '总脂肪'],
        'calcium': ['鈣', '钙', 'ca'],
        'phosphorus': ['磷', 'p'],
        'magnesium': ['鎂', '镁', 'mg'],
        'sodium': ['鈉', '钠', 'na'],
        'carbohydrate': ['碳水化合物', '碳水', '醣類', '糖类']
    }
    
    # 尋找數值和百分比
    for nutrient, terms in cn_terms.items():
        pattern_list = []
        for term in terms:
            # 匹配 "蛋白質 10%" 或 "蛋白質10%" 或 "蛋白質:10%" 或 "蛋白質：10%"
            pattern_list.append(fr'{term}\s*[:：]?\s*(\d+(?:\.\d+)?)\s*[%％]')
            # 匹配 "蛋白質 10g" 或 "蛋白質10g" 或 "蛋白質:10g" 或 "蛋白質：10g"
            pattern_list.append(fr'{term}\s*[:：]?\s*(\d+(?:\.\d+)?)\s*g')
        
        # 合併所有模式
        combined_pattern = '|'.join(pattern_list)
        
        # 搜索匹配
        matches = re.findall(combined_pattern, text)
        
        if matches:
            try:
                # 使用找到的第一個匹配值
                value = float(matches[0])
                nutrition_info[nutrient] = value
                
                # 檢查數值的合理性
                if (nutrient == 'protein' and value > 50) or \
                   (nutrient == 'fat' and value > 40) or \
                   (nutrient == 'carbohydrate' and value > 60) or \
                   (nutrient in ['calcium', 'phosphorus', 'magnesium', 'sodium'] and value > 5):
                    warnings.append(f"{nutrient}值可能不準確：{value}")
            except Exception as e:
                logger.warning(f"無法解析{nutrient}的值: {e}")
    
    return nutrition_info, warnings 