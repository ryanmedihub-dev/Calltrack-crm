// Reactotron only runs in dev mode — zero impact on production builds
import { Platform } from 'react-native';

if (__DEV__) {
  const Reactotron = require('reactotron-react-native').default;
  const reactotronApisauce = require('reactotron-apisauce').default
    || require('reactotron-apisauce');

  Reactotron
    .configure({
      // Android physical device pe ADB reverse use hota hai (port 9090)
      // iOS simulator pe localhost kaam karta hai
      host: Platform.OS === 'android' ? '10.0.2.2' : 'localhost',
      port: 9090,
      name: 'CallTrack',
    })
    .useReactNative({
      asyncStorage: true,     // AsyncStorage changes dekho
      networking: {           // All API calls dekho
        ignoreUrls: /symbolicate/,
      },
      editor: false,
      errors: { veto: () => false },
      overlay: false,
    })
    .use(reactotronApisauce())  // axios/apisauce calls track karo
    .connect();

  // console.log aur console.warn Reactotron mein bhi dikhenge
  console.tron = Reactotron;

  // Clear previous session logs on reload
  Reactotron.clear();

  console.log('[Reactotron] Connected ✓');
}
