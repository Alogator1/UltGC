import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getActiveSubscriptions,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
} from 'react-native-iap';

export const PRODUCT_ID = 'com.groltor.ultgc.premium.monthly';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState(null);

  useEffect(() => {
    let purchaseUpdateSub;
    let purchaseErrorSub;

    const setup = async () => {
      try {
        await initConnection();

        // Restore cached status — source of truth between launches
        const cached = await AsyncStorage.getItem('isPremium');
        if (cached === 'true') setIsPremium(true);

        // Fetch product info (v15: fetchProducts with type)
        const products = await fetchProducts({ skus: [PRODUCT_ID], type: 'subs' });
        if (products.length > 0) setProduct(products[0]);

        // Listen for new/completed purchases
        purchaseUpdateSub = purchaseUpdatedListener(async (purchase) => {
          if (purchase?.productId === PRODUCT_ID) {
            await finishTransaction({ purchase, isConsumable: false });
            setIsPremium(true);
            await AsyncStorage.setItem('isPremium', 'true');
          }
        });

        purchaseErrorSub = purchaseErrorListener((error) => {
          console.log('[IAP] Purchase error:', error.message);
        });
      } catch (e) {
        console.log('[IAP] Setup error:', e.message);
      }
    };

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };
  }, []);

  const syncPurchaseStatus = async () => {
    try {
      const activeSubs = await getActiveSubscriptions([PRODUCT_ID]);
      if (activeSubs.length === 0) return; // no data — keep current status
      const active = activeSubs.some((s) => s.productId === PRODUCT_ID && s.isActive);
      setIsPremium(active);
      await AsyncStorage.setItem('isPremium', String(active));
    } catch (e) {
      console.log('[IAP] Error syncing purchases:', e.message);
    }
  };

  const purchasePremium = async () => {
    setIsLoading(true);
    try {
      await requestPurchase({
        type: 'subs',
        request: {
          apple: { sku: PRODUCT_ID },
        },
      });
    } catch (e) {
      // E_ALREADY_OWNED means they have an active sub — just restore it
      if (e.code === 'E_ALREADY_OWNED' || e.message?.includes('already')) {
        await syncPurchaseStatus();
      } else {
        console.log('[IAP] requestPurchase error:', e.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    setIsLoading(true);
    try {
      await syncPurchaseStatus();
    } catch (e) {
      console.log('[IAP] Restore error:', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider value={{ isPremium, isLoading, product, purchasePremium, restorePurchases }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
