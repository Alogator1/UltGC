let InterstitialAd, AdEventType, TestIds;
let adsAvailable = false;

try {
  const ads = require('react-native-google-mobile-ads');
  InterstitialAd = ads.InterstitialAd;
  AdEventType = ads.AdEventType;
  TestIds = ads.TestIds;
  adsAvailable = true;
} catch (e) {
  // Ads module not available (e.g., in Expo Go)
  adsAvailable = false;
}

// Use test IDs during development
const getInterstitialAdUnitId = () => {
  if (!adsAvailable) return '';
  return __DEV__
    ? TestIds.INTERSTITIAL
    : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy'; // Replace with your real ad unit ID
};

let interstitialAd = null;
let isAdLoaded = false;

export const loadInterstitialAd = () => {
  if (!adsAvailable) return;

  interstitialAd = InterstitialAd.createForAdRequest(getInterstitialAdUnitId(), {
    requestNonPersonalizedAdsOnly: true,
  });

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    isAdLoaded = true;
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    isAdLoaded = false;
    // Load a new ad for next time
    loadInterstitialAd();
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
    console.log('Interstitial ad error:', error);
    isAdLoaded = false;
  });

  interstitialAd.load();
};

export const showInterstitialAd = async () => {
  if (!adsAvailable) return false;

  if (isAdLoaded && interstitialAd) {
    await interstitialAd.show();
    return true;
  }
  return false;
};

export const isInterstitialAdReady = () => isAdLoaded;

export const isAdsAvailable = () => adsAvailable;
