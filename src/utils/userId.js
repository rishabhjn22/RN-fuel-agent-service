import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'fuel_agent_user_id';

function generateFallbackUUID() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

export async function getStableUserId() {
  let userId = await AsyncStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = generateFallbackUUID();
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}
