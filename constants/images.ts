/**
 * Local Stitch design images downloaded from GharKaSwad Marketplace HTML.
 * Paths are require()'d so Metro / Expo web can bundle them.
 */
export const stitchImages = {
  welcomeHero: require('../assets/stitch/images/welcome-22.jpg'),
  welcomeAtmosphere: require('../assets/stitch/images/welcome-21.jpg'),
  loginHero: require('../assets/stitch/images/login-otp-18.jpg'),
  naniPortrait: require('../assets/stitch/images/chef-profile-05.jpg'),
  kitchenHero: require('../assets/stitch/images/chef-profile-04.jpg'),
  thaliHero: require('../assets/stitch/images/thali-builder-20.jpg'),
  thaliDish: require('../assets/stitch/images/chef-profile-06.jpg'),
  parathaDish: require('../assets/stitch/images/chef-profile-07.jpg'),
  rajmaDish: require('../assets/stitch/images/chef-profile-08.jpg'),
  theplaDish: require('../assets/stitch/images/chef-profile-09.jpg'),
  discoverChef: require('../assets/stitch/images/discover-meals-11.jpg'),
  discoverThali: require('../assets/stitch/images/discover-meals-15.jpg'),
  discoverDal: require('../assets/stitch/images/discover-meals-16.jpg'),
  cartItem: require('../assets/stitch/images/cart-checkout-01.jpg'),
  checkoutHero: require('../assets/stitch/images/cart-checkout-02.jpg'),
  paymentFailedItem: require('../assets/stitch/images/payment-failed-01.jpg'),
  trackingMap: require('../assets/stitch/images/tracking-map-01.jpg'),
  trackingPartner: require('../assets/stitch/images/tracking-partner-01.jpg'),
} as const;

export type StitchImageKey = keyof typeof stitchImages;
