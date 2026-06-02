import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ─── Identidade do aplicativo ─────────────────────────────────────────────
  appId: 'br.com.lasalle.sisra',
  appName: 'La Salle, Cheguei!',

  // ─── Diretório de saída do build web ──────────────────────────────────────
  webDir: 'dist',

  // ─── Servidor (desenvolvimento live-reload) ───────────────────────────────
  // Em desenvolvimento, aponta para o servidor Vite local.
  // Em produção (build de app), remova ou comente o bloco server.
  server: {
    // URL da versão web publicada — usada quando não há bundle local (live update)
    url: 'https://sisra.vercel.app',
    cleartext: false,
  },

  // ─── iOS ──────────────────────────────────────────────────────────────────
  ios: {
    contentInset: 'always',
    backgroundColor: '#070a14',
    // preferredContentMode: 'mobile',
  },

  // ─── Android ─────────────────────────────────────────────────────────────
  android: {
    backgroundColor: '#070a14',
    allowMixedContent: false,
    // Habilita permissões nativas de câmera / microfone
    useLegacyBridge: false,
  },

  // ─── Plugins ─────────────────────────────────────────────────────────────
  plugins: {
    // Push Notifications (futuro)
    // PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },

    // SplashScreen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#070a14',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // StatusBar
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#070a14',
      overlaysWebView: true,
    },
  },
};

export default config;
