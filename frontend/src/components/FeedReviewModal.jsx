import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/FeedReviewModal.module.css';
import Notification from './Notification';
import FeedErrorReportModal from './FeedErrorReportModal';
import LongNotification from './LongNotification';

const FeedReviewModal = ({ feed, isOpen, onClose, onConfirm, onReportError, onErrorReportSuccess }) => {
  const { t } = useTranslation('feed');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [showErrorReportModal, setShowErrorReportModal] = useState(false);
  const [showLongNotification, setShowLongNotification] = useState(false);

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理確認審核
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(feed);
      onClose();
    } catch (error) {
      console.error('審核失敗:', error);
      showNotification(t('reviewModal.messages.reviewFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 處理回報錯誤 - 打開錯誤回報 modal
  const handleReportError = () => {
    setShowErrorReportModal(true);
  };

  // 處理錯誤回報提交
  const handleErrorReportSubmit = async (errorData) => {
    try {
      await onReportError(errorData);
      setShowErrorReportModal(false);
      setShowLongNotification(true);

      // 如果有成功回調，執行它（例如允許使用飼料）
      if (onErrorReportSuccess) {
        onErrorReportSuccess(feed);
      }

      // 不自動關閉主 modal，讓用戶看到長通知並手動關閉
    } catch (error) {
      console.error('回報錯誤失敗:', error);
      throw error;
    }
  };

  // 處理取消
  const handleCancel = () => {
    setNotification('');
    onClose();
  };

  // 處理點擊遮罩關閉 modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      handleCancel();
    }
  };

  if (!isOpen || !feed) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={handleOverlayClick}>
        {notification && (
          <Notification
            message={notification}
            onClose={hideNotification}
          />
        )}
        <div className={styles.modalContainer}>
          <div className={styles.modalHeader}>
            <h2>{feed.name || feed.feedName || '飼料名稱'}</h2>
          </div>

          <div className={styles.modalBody}>
            {/* 飼料圖片區塊 */}
            <div className={styles.imageSection}>
              <div className={styles.feedImageContainer}>
                {feed.frontImage || feed.front_image_url ? (
                  <img
                    src={feed.frontImage || feed.front_image_url}
                    alt={t('reviewModal.alt.feedImage')}
                    className={styles.feedImage}
                  />
                ) : (
                  <div className={styles.feedImagePlaceholder}>
                    {t('page.feedCard.noImage')}
                  </div>
                )}
              </div>
            </div>

            {/* 飼料資訊區塊 */}
            <div className={styles.formSection}>
              <div className={styles.inputGroup}>
                <label>{t('reviewModal.labels.createdBy')}</label>
                <div className={styles.readOnlyField}>
                  {feed.created_by_name || feed.createdByName || t('reviewModal.labels.unknownUser')}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>{t('reviewModal.labels.createdDate')}</label>
                <div className={styles.readOnlyField}>
                  {feed.created_at ? new Date(feed.created_at).toLocaleDateString('zh-TW') : t('reviewModal.labels.unknownDate')}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>{t('detailPage.labels.brand')}</label>
                <div className={styles.readOnlyField}>
                  {feed.brand || t('detailPage.info.noPrice')}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>{t('detailPage.labels.price')}</label>
                <div className={styles.readOnlyField}>
                  {feed.price ? `${t('detailPage.info.pricePrefix')}${feed.price}` : t('detailPage.info.noPrice')}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>{t('detailPage.labels.nutrition')}</label>
                <div className={styles.nutritionContainer}>
                  <div className={styles.nutritionRow}>
                    <span className={styles.nutritionLabel}>{t('detailPage.labels.protein')}</span>
                    <span className={styles.nutritionValue}>{feed.protein || 0}{t('detailPage.info.unit')}</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span className={styles.nutritionLabel}>{t('detailPage.labels.fat')}</span>
                    <span className={styles.nutritionValue}>{feed.fat || 0}{t('detailPage.info.unit')}</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span className={styles.nutritionLabel}>{t('detailPage.labels.carbohydrate')}</span>
                    <span className={styles.nutritionValue}>{feed.carbohydrate || 0}{t('detailPage.info.unit')}</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span className={styles.nutritionLabel}>{t('detailPage.labels.calcium')}</span>
                    <span className={styles.nutritionValue}>{feed.calcium || 0}{t('detailPage.info.unit')}</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span className={styles.nutritionLabel}>{t('detailPage.labels.phosphorus')}</span>
                    <span className={styles.nutritionValue}>{feed.phosphorus || 0}{t('detailPage.info.unit')}</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span className={styles.nutritionLabel}>{t('detailPage.labels.magnesium')}</span>
                    <span className={styles.nutritionValue}>{feed.magnesium || 0}{t('detailPage.info.unit')}</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span className={styles.nutritionLabel}>{t('detailPage.labels.sodium')}</span>
                    <span className={styles.nutritionValue}>{feed.sodium || 0}{t('detailPage.info.unit')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              className={styles.reportButton}
              onClick={handleReportError}
              disabled={loading}
            >
              {t('reviewModal.buttons.reportError')}
            </button>
            <button
              className={styles.confirmButton}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? t('reviewModal.buttons.processing') : t('reviewModal.buttons.confirm')}
            </button>
          </div>
        </div>
      </div>

      {/* 錯誤回報 Modal */}
      <FeedErrorReportModal
        feed={feed}
        isOpen={showErrorReportModal}
        onClose={() => setShowErrorReportModal(false)}
        onSubmit={handleErrorReportSubmit}
      />

      {/* 長通知 */}
      {showLongNotification && (
        <LongNotification
          message={t('reviewModal.messages.errorReportSuccess')}
          onClose={() => {
            setShowLongNotification(false);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default FeedReviewModal;
