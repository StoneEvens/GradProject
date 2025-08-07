import React, { useEffect, useRef } from 'react';
import styles from '../styles/ContextMenu.module.css';

const ContextMenu = ({ visible, x, y, items, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{
        top: y,
        left: x,
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={`${styles.menuItem} ${item.danger ? styles.danger : ''}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon && <img src={item.icon} alt="" className={styles.menuIcon} />}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;