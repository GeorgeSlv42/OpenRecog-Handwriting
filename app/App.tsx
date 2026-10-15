import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet } from 'react-native'
import { RecognizeScreen } from './src/screens/RecognizeScreen'

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <RecognizeScreen />
      <StatusBar style="dark" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fb' },
})
