import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform, StatusBar,
} from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console so dev can see in Metro / Logcat
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const errMsg = this.state.error?.message || 'Unknown error';
    const isDev  = __DEV__;

    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FB" />
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.title}>Kuch galat ho gaya</Text>
          <Text style={s.subtitle}>
            App mein ek unexpected error aaya. Retry karo — usually theek ho jaata hai.
          </Text>

          {isDev && (
            <View style={s.devBox}>
              <Text style={s.devLabel}>Error (dev only):</Text>
              <Text style={s.devMsg}>{errMsg}</Text>
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={this.handleRetry} activeOpacity={0.85}>
            <Text style={s.btnText}>Retry karo</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingTop: Platform.OS === 'android' ? 48 : 64,
  },
  icon: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  devBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devMsg: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  btn: {
    backgroundColor: '#1A6BFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
