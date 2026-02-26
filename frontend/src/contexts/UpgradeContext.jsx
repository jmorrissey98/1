import { createContext, useContext, useState, useCallback } from 'react';
import { UpgradeModal } from '../components/UpgradeModal';

const UpgradeContext = createContext(null);

export function UpgradeProvider({ children, onSubscriptionChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const openUpgradeModal = () => setIsOpen(true);
  const closeUpgradeModal = () => setIsOpen(false);

  const handleSubscriptionChange = useCallback(() => {
    if (onSubscriptionChange) {
      onSubscriptionChange();
    }
  }, [onSubscriptionChange]);

  return (
    <UpgradeContext.Provider value={{ openUpgradeModal, closeUpgradeModal, isOpen }}>
      {children}
      <UpgradeModal 
        open={isOpen} 
        onOpenChange={setIsOpen}
        onSubscriptionChange={handleSubscriptionChange}
      />
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const context = useContext(UpgradeContext);
  if (!context) {
    throw new Error('useUpgrade must be used within an UpgradeProvider');
  }
  return context;
}
