import { createContext, useContext, useState } from 'react';
import { UpgradeModal } from '../components/UpgradeModal';

const UpgradeContext = createContext(null);

export function UpgradeProvider({ children, currentTier = null }) {
  const [isOpen, setIsOpen] = useState(false);

  const openUpgradeModal = () => setIsOpen(true);
  const closeUpgradeModal = () => setIsOpen(false);

  return (
    <UpgradeContext.Provider value={{ openUpgradeModal, closeUpgradeModal, isOpen }}>
      {children}
      <UpgradeModal 
        open={isOpen} 
        onOpenChange={setIsOpen}
        currentTier={currentTier}
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
