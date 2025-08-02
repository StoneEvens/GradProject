// 歷史紀錄在 localStorage 中的 key
const HISTORY_KEY = 'calculator_history_records';

// 獲取所有歷史紀錄
export const getHistoryRecords = () => {
  try {
    const records = localStorage.getItem(HISTORY_KEY);
    return records ? JSON.parse(records) : [];
  } catch (error) {
    console.error('讀取歷史紀錄失敗:', error);
    return [];
  }
};

// 儲存新的歷史紀錄
export const saveHistoryRecord = (record) => {
  try {
    const records = getHistoryRecords();
    
    // 新增 id 和時間戳
    const newRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      ...record
    };
    
    // 將新紀錄加到最前面
    records.unshift(newRecord);
    
    // 限制最多儲存 10 筆紀錄
    if (records.length > 10) {
      records.pop();
    }
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
    return newRecord;
  } catch (error) {
    console.error('儲存歷史紀錄失敗:', error);
    return null;
  }
};

// 刪除單筆歷史紀錄
export const deleteHistoryRecord = (recordId) => {
  try {
    const records = getHistoryRecords();
    const filteredRecords = records.filter(record => record.id !== recordId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filteredRecords));
    return true;
  } catch (error) {
    console.error('刪除歷史紀錄失敗:', error);
    return false;
  }
};

// 清空所有歷史紀錄
export const clearAllHistoryRecords = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
    return true;
  } catch (error) {
    console.error('清空歷史紀錄失敗:', error);
    return false;
  }
};

// 根據寵物 ID 篩選歷史紀錄
export const getHistoryRecordsByPetId = (petId) => {
  const records = getHistoryRecords();
  return records.filter(record => record.petId === petId);
};

// 根據日期範圍篩選歷史紀錄
export const getHistoryRecordsByDateRange = (startDate, endDate) => {
  const records = getHistoryRecords();
  return records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= startDate && recordDate <= endDate;
  });
};