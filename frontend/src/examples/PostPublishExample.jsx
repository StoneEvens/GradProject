import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost } from '../services/socialService';

/**
 * 貼文發布功能測試範例
 * 
 * 此範例展示如何使用新的 createPost API 來發布包含圖片和標註的貼文
 */
const PostPublishExample = () => {
  const navigate = useNavigate();
  const [isPublishing, setIsPublishing] = useState(false);
  const [result, setResult] = useState(null);

  // 測試用的貼文資料
  const testPostData = {
    content: '這是一個測試貼文，包含圖片和標註功能！',
    location: '台北市',
    hashtags: '測試,貼文,功能',
    images: [], // 在實際使用時，這裡會是 File 物件陣列
    annotations: [
      {
        image_index: 0,
        x_position: 30,
        y_position: 40,
        display_name: '測試標註',
        target_type: 'user',
        target_id: 1
      }
    ]
  };

  // 測試發布功能
  const testPublish = async () => {
    if (isPublishing) return;

    try {
      setIsPublishing(true);
      setResult(null);

      console.log('開始測試發布...');
      
      // 模擬圖片檔案（在實際使用中，這會是用戶選擇的圖片）
      const mockImageFile = new File(['test image content'], 'test.jpg', {
        type: 'image/jpeg'
      });
      
      const publishData = {
        ...testPostData,
        images: [mockImageFile]
      };

      const response = await createPost(publishData);
      
      setResult({
        success: response.success,
        message: response.message || response.error,
        data: response.data
      });

      if (response.success) {
        console.log('發布成功！', response);
        // 可以導航到社群頁面
        // navigate('/social');
      } else {
        console.error('發布失敗:', response.error);
      }

    } catch (error) {
      console.error('測試發布時發生錯誤:', error);
      setResult({
        success: false,
        message: error.message,
        data: null
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>貼文發布功能測試</h1>
      
      <div style={{
        background: '#f5f5f5',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>測試資料：</h3>
        <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(testPostData, null, 2)}
        </pre>
      </div>

      <button
        onClick={testPublish}
        disabled={isPublishing}
        style={{
          background: isPublishing ? '#ccc' : '#F08651',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: isPublishing ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {isPublishing ? '發布中...' : '測試發布'}
      </button>

      {result && (
        <div style={{
          background: result.success ? '#d4edda' : '#f8d7da',
          color: result.success ? '#155724' : '#721c24',
          padding: '15px',
          borderRadius: '8px',
          border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          <h3>發布結果：</h3>
          <p><strong>狀態：</strong>{result.success ? '成功' : '失敗'}</p>
          <p><strong>訊息：</strong>{result.message}</p>
          {result.data && (
            <div>
              <strong>返回資料：</strong>
              <pre style={{ 
                background: 'rgba(0,0,0,0.1)', 
                padding: '10px', 
                borderRadius: '4px',
                marginTop: '10px'
              }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '30px',
        padding: '15px',
        background: '#e7f3ff',
        borderRadius: '8px'
      }}>
        <h3>使用說明：</h3>
        <ul>
          <li>此測試會調用 <code>createPost</code> API</li>
          <li>包含模擬的圖片檔案和標註資料</li>
          <li>會顯示發布的結果和任何錯誤訊息</li>
          <li>實際使用時，圖片應該來自用戶選擇的檔案</li>
          <li>標註資料包含圖片索引、座標和目標資訊</li>
        </ul>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#fff3cd',
        borderRadius: '8px'
      }}>
        <h3>注意事項：</h3>
        <ul>
          <li>確保後端服務正在運行</li>
          <li>需要有效的認證 Token</li>
          <li>Firebase Storage 需要正確配置</li>
          <li>圖片大小不能超過 5MB</li>
        </ul>
      </div>
    </div>
  );
};

export default PostPublishExample; 