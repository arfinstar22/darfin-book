import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.darfinbook.app',
  appName: 'DARFIN BOOK',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#080E1E',
  },
};

export default config;
