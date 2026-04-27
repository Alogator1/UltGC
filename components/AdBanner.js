import { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';

let BannerAd, BannerAdSize, TestIds;
let adsModule = null;
let loadError = null;

try {
  adsModule = require('react-native-google-mobile-ads');
  BannerAd = adsModule.BannerAd;
  BannerAdSize = adsModule.BannerAdSize;
  TestIds = adsModule.TestIds;
} catch (e) {
  loadError = e.message;
}

// Flip to false once AdMob account is approved
const USE_TEST_ADS = true;

const PROD_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || '';

const getAdUnitId = () => {
  if (!adsModule || !TestIds) return '';
  if (USE_TEST_ADS || __DEV__ || !PROD_BANNER_ID) return TestIds.BANNER;
  return PROD_BANNER_ID;
};

export default function AdBanner() {
  const { isPremium } = useSubscription();
  const [adError, setAdError] = useState(null);

  // Don't show ads to premium users
  if (isPremium) {
    return null;
  }

  // Ads module not loaded (Expo Go or missing native module)
  if (!adsModule || !BannerAd) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          {loadError ? `Ad error: ${loadError}` : 'Ad Banner (dev build required)'}
        </Text>
      </View>
    );
  }

  // Ad loaded but failed to display
  if (adError) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ad load error: {adError}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={getAdUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.log('Ad failed to load:', error);
          setAdError(error.message || 'Unknown error');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
});
