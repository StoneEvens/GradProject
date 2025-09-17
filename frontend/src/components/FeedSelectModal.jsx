import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../utils/axios';
import styles from '../styles/FeedSelectModal.module.css';
import { useUser } from '../context/UserContext';

const FeedSelectModal = ({ isOpen, onClose, onSelectFeed, petType }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('feed');
  const { userData } = useUser();
  const [loading, setLoading] = useState(true);
  const [markedFeeds, setMarkedFeeds] = useState([]);
  const [recentFeeds, setRecentFeeds] = useState([]);
  const [markedMessage, setMarkedMessage] = useState('');
  const [recentMessage, setRecentMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFeeds();
    }
  }, [isOpen, petType]);

  const loadFeeds = async () => {
    try {
      setLoading(true);
      
      // 根據寵物類型過濾飼料
      const petTypeParam = petType ? `&pet_type=${petType}` : '';
      
      // 並行載入精選飼料和最近使用飼料
      const [markedResponse, recentResponse] = await Promise.all([
        axios.get(`/feeds/my-marked/preview/?limit=6${petTypeParam}`),
        axios.get(`/feeds/recently-used/?limit=6${petTypeParam}`)
      ]);
      
      // 處理精選飼料，並根據寵物類型過濾
      const markedData = markedResponse.data.data
        .filter(item => !petType || item.feed.pet_type === petType)
        .map(item => ({
          id: item.feed.id,
          markId: item.id,
          name: item.feed.name || '',
          brand: item.feed.brand || '',
          price: item.feed.price,
          protein: item.feed.protein,
          fat: item.feed.fat,
          carbohydrate: item.feed.carbohydrate,
          calcium: item.feed.calcium,
          phosphorus: item.feed.phosphorus,
          magnesium: item.feed.magnesium,
          sodium: item.feed.sodium,
          frontImage: item.feed.front_image_url,
          isMarked: true,
          isVerified: item.feed.is_verified,
          reviewCount: item.feed.review_count,
          created_by: item.feed.created_by,
          created_by_id: item.feed.created_by_id,
          created_by_name: item.feed.created_by_name,
          created_at: item.feed.created_at,
          lastUsedAt: item.created_at,
          pet_type: item.feed.pet_type
        }));
      setMarkedFeeds(markedData);
      setMarkedMessage(markedData.length > 0 ? markedResponse.data.message : t('selectModal.messages.noMarkedFeeds'));
      
      // 處理最近使用飼料，並根據寵物類型過濾
      const recentData = recentResponse.data.data
        .filter(item => !petType || item.pet_type === petType)
        .map(item => ({
          id: item.id,
          name: item.name || '',
          brand: item.brand || '',
          price: item.price,
          protein: item.protein,
          fat: item.fat,
          carbohydrate: item.carbohydrate,
          calcium: item.calcium,
          phosphorus: item.phosphorus,
          magnesium: item.magnesium,
          sodium: item.sodium,
          frontImage: item.front_image_url,
          isMarked: item.is_marked,
          isVerified: item.is_verified,
          reviewCount: item.review_count,
          usageCount: item.usage_count,
          created_by: item.created_by,
          created_by_id: item.created_by_id,
          created_by_name: item.created_by_name,
          created_at: item.created_at,
          lastUsedAt: item.last_used_at,
          petName: item.pet_name,
          pet_type: item.pet_type
        }));
      setRecentFeeds(recentData);
      setRecentMessage(recentData.length > 0 ? recentResponse.data.message : t('selectModal.messages.noRecentFeeds'));
      
    } catch (error) {
      console.error(t('selectModal.messages.loadError'), error);
      setMarkedFeeds([]);
      setRecentFeeds([]);
      setMarkedMessage(t('selectModal.messages.loadFailed'));
      setRecentMessage(t('selectModal.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleFeedSelect = (feed) => {
    // 轉換為 CalculatorStep2 期望的格式
    const formattedFeed = {
      id: feed.id,
      name: feed.name,
      brand: feed.brand,
      img: feed.frontImage,
      carb: feed.carbohydrate ?? 0,
      protein: feed.protein ?? 0,
      fat: feed.fat ?? 0,
      ca: feed.calcium ?? 0,
      p: feed.phosphorus ?? 0,
      mg: feed.magnesium ?? 0,
      na: feed.sodium ?? 0,
      price: feed.price,
      review_count: feed.reviewCount ?? 0,
      is_verified: feed.isVerified ?? false,
      pet_type: feed.pet_type || petType
    };
    
    onSelectFeed(formattedFeed);
    onClose();
  };

  const renderFeedCard = (feed) => {
    const isCreator = userData && feed.created_by_id === userData.id;
    
    return (
      <div 
        key={feed.markId || feed.id} 
        className={styles.feedCard} 
        onClick={() => handleFeedSelect(feed)}
      >
        <div className={styles.feedImageContainer}>
          {feed.frontImage ? (
            <img src={feed.frontImage} alt={feed.name} className={styles.feedImage} />
          ) : (
            <div className={styles.feedImagePlaceholder}>
              <span>{t('page.feedCard.noImage')}</span>
            </div>
          )}
          {/* 審核中標示 */}
          {!feed.isVerified && (
            <div className={styles.verifyingBadge}>
              <img src="/assets/icon/Verifying.png" alt={t('page.feedCard.verifying')} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // 處理點擊遮罩關閉 modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2>{t('selectModal.title')}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            {t('selectModal.buttons.close')}
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <span>{t('selectModal.loading')}</span>
            </div>
          ) : (
            <>
              {/* 精選飼料區域 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>{t('selectModal.sections.marked')}</label>
                <div className={styles.sectionContent}>
                  {markedFeeds.length > 0 ? (
                    <div className={styles.feedGrid}>
                      {markedFeeds.map(feed => renderFeedCard(feed))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <img src="/assets/icon/SearchNoResult.png" alt={t('page.emptyState.noResult')} className={styles.noResultImage} />
                      <p>
                        {markedMessage === t('selectModal.messages.noMarkedFeeds') ? (
                          <>
                            {t('selectModal.messages.noMarkedFeedsWithLink').split('-')[0]}-
                            <span
                              className={styles.feedLink}
                              onClick={() => navigate('/feeds')}
                            >
                              {t('selectModal.alt.feedSection')}
                            </span>
                            {t('selectModal.messages.noMarkedFeedsWithLink').split('-')[1] || '新增'}
                          </>
                        ) : markedMessage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 最近使用區域 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>{t('selectModal.sections.recent')}</label>
                <div className={styles.sectionContent}>
                  {recentFeeds.length > 0 ? (
                    <div className={styles.feedGrid}>
                      {recentFeeds.map(feed => renderFeedCard(feed))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <img src="/assets/icon/SearchNoResult.png" alt={t('page.emptyState.noResult')} className={styles.noResultImage} />
                      <p>{recentMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedSelectModal;