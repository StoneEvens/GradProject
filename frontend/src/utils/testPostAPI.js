import { createPost } from '../services/socialService';

/**
 * 測試貼文發布 API 的工具函數
 */
export const testPostAPI = async () => {
  console.log('開始測試貼文發布 API...');
  
  try {
    // 創建一個簡單的測試圖片檔案
    const testImageBlob = new Blob(['test image content'], { type: 'image/jpeg' });
    const testImageFile = new File([testImageBlob], 'test.jpg', { type: 'image/jpeg' });
    
    // 準備測試資料
    const testPostData = {
      content: '這是一個 API 測試貼文',
      location: '台北市',
      hashtags: '測試,API',
      images: [testImageFile],
      annotations: [
        {
          image_index: 0,
          x_position: 50,
          y_position: 30,
          display_name: '測試標註',
          target_type: 'user',
          target_id: 1
        }
      ]
    };
    
    console.log('發送測試資料:', {
      content: testPostData.content,
      location: testPostData.location,
      hashtags: testPostData.hashtags,
      imageCount: testPostData.images.length,
      annotationCount: testPostData.annotations.length
    });
    
    // 調用 API
    const result = await createPost(testPostData);
    
    console.log('API 測試結果:', result);
    
    if (result.success) {
      console.log('✅ API 測試成功！');
      return { success: true, data: result.data };
    } else {
      console.log('❌ API 測試失敗:', result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('❌ API 測試發生錯誤:', error);
    return { success: false, error: error.message };
  }
};

// 僅測試基本貼文（無圖片和標註）
export const testBasicPost = async () => {
  console.log('開始測試基本貼文發布...');
  
  try {
    const basicPostData = {
      content: '這是一個基本測試貼文，沒有圖片和標註',
      location: '新北市',
      hashtags: '基本測試',
      images: [],
      annotations: []
    };
    
    console.log('發送基本測試資料:', basicPostData);
    
    const result = await createPost(basicPostData);
    
    console.log('基本貼文測試結果:', result);
    
    if (result.success) {
      console.log('✅ 基本貼文測試成功！');
      return { success: true, data: result.data };
    } else {
      console.log('❌ 基本貼文測試失敗:', result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('❌ 基本貼文測試發生錯誤:', error);
    return { success: false, error: error.message };
  }
};

// 測試 hashtag 功能
export const testHashtagPost = async () => {
  console.log('🏷️ 開始測試 hashtag 功能...');
  
  try {
    const testData = {
      content: '今天帶我的狗狗去公園玩！ #寵物 #開心',
      location: '台北大安森林公園',
      hashtags: ['寵物', '狗狗', '公園', '開心'],
      images: [],
      annotations: []
    };
    
    console.log('測試資料:', testData);
    
    // 模擬前端 hashtag 處理邏輯
    const hashtagString = testData.hashtags.map(tag => tag).join(',');
    console.log('hashtag 字串:', hashtagString);
    
    const formData = new FormData();
    formData.append('content', testData.content);
    formData.append('location', testData.location);
    formData.append('hashtags', hashtagString);
    formData.append('annotations', JSON.stringify(testData.annotations));
    
    console.log('FormData 內容:');
    for (let pair of formData.entries()) {
      console.log(`${pair[0]}: ${pair[1]}`);
    }
    
    const response = await createPost(formData);
    console.log('✅ Hashtag 測試成功!', response);
    return response;
    
  } catch (error) {
    console.error('❌ Hashtag 測試失敗:', error);
    throw error;
  }
};

// 測試 hashtag 渲染修復
export const testHashtagRendering = () => {
  console.log('🏷️ 開始測試 hashtag 渲染修復...');
  
  // 模擬不同格式的 hashtag 數據
  const testHashtags = [
    // 後端格式 (新)
    { id: 1, tag: '寵物' },
    { id: 2, tag: '開心' },
    
    // 舊格式
    { id: 3, text: '貓咪' },
    { id: 4, text: '可愛' },
    
    // 字串格式
    '遊戲',
    '健康',
    
    // 混合格式
    { id: 7, tag: '測試', text: '不應該用到' },
    { id: 8, text: '備選', tag: '主要' } // 應該優先使用 tag
  ];
  
  console.log('📋 測試數據:', testHashtags);
  
  // 測試渲染邏輯
  const renderHashtag = (tag, index) => {
    const tagText = tag.tag || tag.text || (typeof tag === 'string' ? tag : '');
    return `#${tagText}`;
  };
  
  console.log('🎨 渲染結果:');
  testHashtags.forEach((tag, index) => {
    const rendered = renderHashtag(tag, index);
    console.log(`  ${index + 1}. ${JSON.stringify(tag)} → "${rendered}"`);
  });
  
  // 測試發布時的處理邏輯
  const publishHashtags = testHashtags.map(tag => {
    return tag.tag || tag.text || (typeof tag === 'string' ? tag : '');
  }).filter(Boolean).join(',');
  
  console.log('📤 發布格式:', `"${publishHashtags}"`);
  
  // 測試重複檢查邏輯
  const checkDuplicate = (hashtags, newTag) => {
    return hashtags.some(tag => {
      const existingTagText = tag.tag || tag.text || (typeof tag === 'string' ? tag : '');
      return existingTagText === newTag;
    });
  };
  
  console.log('🔍 重複檢查測試:');
  console.log('  檢查 "寵物" 是否重複:', checkDuplicate(testHashtags, '寵物')); // 應該是 true
  console.log('  檢查 "新標籤" 是否重複:', checkDuplicate(testHashtags, '新標籤')); // 應該是 false
  
  console.log('✅ Hashtag 渲染修復測試完成！');
};

// 測試暫存資料清理功能
export const testClearCache = () => {
  console.log('🧹 開始測試暫存資料清理功能...');
  
  // 先創建一些測試暫存資料
  const testData = {
    createPostDraft: JSON.stringify({ test: 'draft data' }),
    imageAnnotations: JSON.stringify({ test: 'annotation data' }),
    annotationTemp: 'temp data',
    unrelatedData: 'should not be cleared'
  };
  
  console.log('📝 創建測試暫存資料...');
  Object.entries(testData).forEach(([key, value]) => {
    localStorage.setItem(key, value);
    console.log(`設置: ${key} = ${value}`);
  });
  
  console.log('📋 清理前的 localStorage:', Object.keys(localStorage));
  
  // 執行清理（模擬 PostPreviewPage 的清理邏輯）
  try {
    // 清除草稿資料
    localStorage.removeItem('createPostDraft');
    console.log('✅ 已清除草稿資料');
    
    // 清除圖片標註資料
    localStorage.removeItem('imageAnnotations');
    console.log('✅ 已清除圖片標註資料');
    
    // 清除其他可能的暫存資料
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('postDraft') || key.includes('imageAnnotations') || key.includes('annotationTemp'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`✅ 已清除暫存資料: ${key}`);
    });
    
    console.log('🧹 清理完成');
    console.log('📋 清理後的 localStorage:', Object.keys(localStorage));
    
    // 驗證清理結果
    const remaining = Object.keys(localStorage).filter(key => 
      key.includes('postDraft') || key.includes('imageAnnotations') || key.includes('annotationTemp')
    );
    
    if (remaining.length === 0) {
      console.log('✅ 暫存資料清理測試成功！所有相關資料已清除');
    } else {
      console.warn('⚠️ 部分資料未清除:', remaining);
    }
    
    // 檢查不相關資料是否保留
    if (localStorage.getItem('unrelatedData')) {
      console.log('✅ 不相關資料正確保留');
    } else {
      console.warn('⚠️ 不相關資料被誤刪');
    }
    
  } catch (error) {
    console.error('❌ 清理測試失敗:', error);
  }
};

// 快速清理當前暫存資料的工具函數
export const quickClearCache = () => {
  console.log('🧹 執行快速清理...');
  
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('postDraft') || key.includes('imageAnnotations') || key.includes('annotationTemp'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`✅ 清除: ${key}`);
  });
  
  console.log(`🧹 快速清理完成，共清除 ${keysToRemove.length} 項資料`);
};

// 測試獲取貼文列表功能
export const testGetPosts = async () => {
  console.log('📋 開始測試獲取貼文列表功能...');
  
  try {
    const { getPosts } = await import('../services/socialService');
    
    console.log('📤 調用 getPosts API...');
    
    const result = await getPosts({
      offset: 0,
      limit: 5
    });
    
    console.log('📥 API 回應:', result);
    
    if (result.success) {
      console.log('✅ 獲取貼文列表成功!');
      console.log(`📊 獲取到 ${result.data.posts?.length || 0} 篇貼文`);
      console.log(`🔄 還有更多: ${result.data.has_more ? '是' : '否'}`);
      
      if (result.data.posts && result.data.posts.length > 0) {
        console.log('📄 第一篇貼文詳情:');
        const firstPost = result.data.posts[0];
        console.log({
          id: firstPost.id,
          content: firstPost.content?.content_text || '無內容',
          user: firstPost.user_info?.username || '未知用戶',
          created_at: firstPost.created_at,
          images: firstPost.images?.length || 0,
          hashtags: firstPost.hashtags?.length || 0
        });
      }
    } else {
      console.warn('⚠️ 獲取貼文列表失敗:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ 測試獲取貼文列表失敗:', error);
    throw error;
  }
};

// 測試分頁功能
export const testPostsPagination = async () => {
  console.log('📖 開始測試貼文分頁功能...');
  
  try {
    const { getPosts } = await import('../services/socialService');
    
    // 第一頁
    console.log('📄 獲取第一頁...');
    const page1 = await getPosts({ offset: 0, limit: 3 });
    console.log('第一頁結果:', {
      success: page1.success,
      count: page1.data.posts?.length || 0,
      hasMore: page1.data.has_more
    });
    
    if (page1.success && page1.data.has_more) {
      // 第二頁
      console.log('📄 獲取第二頁...');
      const page2 = await getPosts({ offset: 3, limit: 3 });
      console.log('第二頁結果:', {
        success: page2.success,
        count: page2.data.posts?.length || 0,
        hasMore: page2.data.has_more
      });
      
      // 檢查是否有重複的貼文
      const page1Ids = page1.data.posts?.map(p => p.id) || [];
      const page2Ids = page2.data.posts?.map(p => p.id) || [];
      const duplicates = page1Ids.filter(id => page2Ids.includes(id));
      
      if (duplicates.length === 0) {
        console.log('✅ 分頁功能正常，沒有重複貼文');
      } else {
        console.warn('⚠️ 發現重複貼文:', duplicates);
      }
    }
    
  } catch (error) {
    console.error('❌ 測試分頁功能失敗:', error);
    throw error;
  }
};

// 調試貼文數據結構
export const debugPostData = async () => {
  console.log('🔍 開始調試貼文數據結構...');
  
  try {
    const { getPosts } = await import('../services/socialService');
    
    const result = await getPosts({
      offset: 0,
      limit: 1
    });
    
    if (result.success && result.data.posts && result.data.posts.length > 0) {
      const post = result.data.posts[0];
      
      console.log('📊 貼文完整數據結構:');
      console.log(JSON.stringify(post, null, 2));
      
      console.log('\n🔧 數據對應檢查:');
      console.log('用戶資訊:');
      console.log('  - user_info:', post.user_info);
      console.log('  - user:', post.user);
      
      console.log('內容資訊:');
      console.log('  - content:', post.content);
      console.log('  - description:', post.description);
      
      console.log('位置資訊:');
      console.log('  - content.location:', post.content?.location);
      console.log('  - location:', post.location);
      
      console.log('標籤資訊:');
      console.log('  - hashtags:', post.hashtags);
      
      console.log('圖片和標註:');
      console.log('  - images:', post.images);
      console.log('  - annotations:', post.annotations);
      
      console.log('互動統計:');
      console.log('  - interaction_stats:', post.interaction_stats);
      console.log('  - user_interaction:', post.user_interaction);
      
      console.log('\n✅ 數據結構調試完成！');
      
      // 測試 Post 組件所需的數據格式
      console.log('\n🎨 Post 組件格式測試:');
      const userInfo = post.user_info || post.user || {};
      const location = post.content?.location || post.location;
      const description = post.content?.content_text || post.description || '';
      
      console.log('  用戶顯示名:', userInfo.user_account || userInfo.username || '未知用戶');
      console.log('  用戶頭像:', userInfo.headshot_url || '預設頭像');
      console.log('  位置:', location || '無位置');
      console.log('  內容:', description.substring(0, 50) + (description.length > 50 ? '...' : ''));
      console.log('  標籤數量:', post.hashtags?.length || 0);
      console.log('  圖片數量:', post.images?.length || 0);
      console.log('  標註數量:', post.annotations?.length || 0);
      
    } else {
      console.warn('⚠️ 沒有可用的貼文數據');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ 調試數據結構失敗:', error);
    throw error;
  }
};

// 測試中文 hashtag 功能
export const testChineseHashtag = async () => {
  console.log('🏷️ 開始測試中文 hashtag 功能...');
  
  try {
    const testData = {
      content: '今天帶狗狗去公園玩！ #寵物 #開心 很棒的一天',
      location: '台北大安森林公園',
      hashtags: ['寵物日常', '狗狗', '公園遊戲', '快樂時光'],
      images: [],
      annotations: []
    };
    
    console.log('測試資料:', testData);
    
    // 測試前端 hashtag 處理邏輯
    const hashtagString = testData.hashtags.map(tag => tag).join(',');
    console.log('前端處理的 hashtag 字串:', `"${hashtagString}"`);
    
    const formData = new FormData();
    formData.append('content', testData.content);
    formData.append('location', testData.location);
    formData.append('hashtags', hashtagString);
    formData.append('annotations', JSON.stringify(testData.annotations));
    
    console.log('發送的 FormData:');
    for (let pair of formData.entries()) {
      console.log(`  ${pair[0]}: "${pair[1]}"`);
    }
    
    const { createPost } = await import('../services/socialService');
    const response = await createPost(formData);
    
    console.log('API 回應:', response);
    
    if (response.success) {
      console.log('✅ 中文 hashtag 測試成功!');
      console.log('回傳的標籤資料:', response.data.hashtags);
      
      // 檢查標籤是否正確保存
      const expectedTags = ['寵物', '開心', '寵物日常', '狗狗', '公園遊戲', '快樂時光'];
      const returnedTags = response.data.hashtags?.map(h => h.tag) || [];
      
      console.log('期望的標籤:', expectedTags);
      console.log('實際回傳的標籤:', returnedTags);
      
      expectedTags.forEach(tag => {
        if (returnedTags.includes(tag)) {
          console.log(`✅ 標籤 "${tag}" 正確保存`);
        } else {
          console.warn(`⚠️ 標籤 "${tag}" 未正確保存`);
        }
      });
      
    } else {
      console.error('❌ 中文 hashtag 測試失敗:', response.error);
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ 中文 hashtag 測試失敗:', error);
    throw error;
  }
};

// 測試各種 hashtag 格式
export const testVariousHashtagFormats = async () => {
  console.log('🧪 開始測試各種 hashtag 格式...');
  
  const testCases = [
    {
      name: '純中文標籤',
      content: '今天很開心 #寵物日常 #貓咪',
      hashtags: ['狗狗', '快樂']
    },
    {
      name: '混合語言標籤',
      content: 'Happy day #pet #開心',
      hashtags: ['dog', '寵物', 'fun時光']
    },
    {
      name: '數字和符號',
      content: '2024年的回憶 #2024回憶',
      hashtags: ['year2024', '美好時光']
    },
    {
      name: '特殊字符',
      content: '測試內容',
      hashtags: ['寵物-日常', '狗狗&貓咪', '100%快樂']
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 測試: ${testCase.name}`);
    
    try {
      const hashtagString = testCase.hashtags.join(',');
      const formData = new FormData();
      formData.append('content', testCase.content);
      formData.append('location', '測試地點');
      formData.append('hashtags', hashtagString);
      formData.append('annotations', JSON.stringify([]));
      
      const { createPost } = await import('../services/socialService');
      const result = await createPost(formData);
      
      if (result.success) {
        const returnedTags = result.data.hashtags?.map(h => h.tag) || [];
        console.log(`  ✅ 成功，返回標籤: [${returnedTags.join(', ')}]`);
      } else {
        console.warn(`  ⚠️ 失敗: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`  ❌ 錯誤: ${error.message}`);
    }
  }
  
  console.log('\n�� 各種格式測試完成');
};

// 在瀏覽器控制台中可用的測試函數
if (typeof window !== 'undefined') {
  window.testPostAPI = testPostAPI;
  window.testBasicPost = testBasicPost;
  window.testHashtagPost = testHashtagPost;
  window.testClearCache = testClearCache;
  window.quickClearCache = quickClearCache;
  window.testGetPosts = testGetPosts;
  window.testPostsPagination = testPostsPagination;
  window.testHashtagRendering = testHashtagRendering;
  window.debugPostData = debugPostData;
  window.testChineseHashtag = testChineseHashtag;
  window.testVariousHashtagFormats = testVariousHashtagFormats;
  console.log('測試函數已載入到 window 物件：');
  console.log('- 使用 testPostAPI() 測試完整貼文發布');
  console.log('- 使用 testBasicPost() 測試基本貼文發布');
  console.log('- 使用 testHashtagPost() 測試 hashtag 功能');
  console.log('- 使用 testClearCache() 測試暫存資料清理');
  console.log('- 使用 quickClearCache() 快速清理當前暫存資料');
  console.log('- 使用 testGetPosts() 測試獲取貼文列表');
  console.log('- 使用 testPostsPagination() 測試貼文分頁功能');
  console.log('- 使用 testHashtagRendering() 測試 hashtag 渲染修復');
  console.log('- 使用 debugPostData() 調試貼文數據結構');
  console.log('- 使用 testChineseHashtag() 測試中文 hashtag 功能');
  console.log('- 使用 testVariousHashtagFormats() 測試各種 hashtag 格式');
} 