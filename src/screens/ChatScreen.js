import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    PermissionsAndroid,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendMessage } from '../api/agent';

// Animated typing indicator component
const TypingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDot = (dot, delay) => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                ])
            ).start();
        };
        animateDot(dot1, 0);
        animateDot(dot2, 150);
        animateDot(dot3, 300);
    }, [dot1, dot2, dot3]);

    const dotStyle = (anim) => ({
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
    });

    return (
        <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
                <Animated.View style={[styles.typingDot, dotStyle(dot1)]} />
                <Animated.View style={[styles.typingDot, dotStyle(dot2)]} />
                <Animated.View style={[styles.typingDot, dotStyle(dot3)]} />
            </View>
        </View>
    );
};

const WELCOME_MESSAGE = {
    id: '1',
    text: 'Hello! I can help you find fuel, parking, and amenities. How can I help?',
    sender: 'bot',
};

const ChatScreen = () => {
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState({ latitude: 0, longitude: 0 });
    const [userId, setUserId] = useState(null);
    const flatListRef = useRef(null);

    // Get or create stable userId
    useEffect(() => {
        const initUserId = async () => {
            let id = await AsyncStorage.getItem('fuel_user_id');
            if (!id) {
                id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                await AsyncStorage.setItem('fuel_user_id', id);
            }
            setUserId(id);
        };
        initUserId();
    }, []);

    useEffect(() => {
        requestLocationPermission();
    }, []);

    // Start new chat - clear messages and generate new userId
    const handleNewChat = async () => {
        const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await AsyncStorage.setItem('fuel_user_id', newId);
        setUserId(newId);
        setMessages([{ ...WELCOME_MESSAGE, id: Date.now().toString() }]);
    };

    const requestLocationPermission = async () => {
        if (Platform.OS === 'ios') {
            Geolocation.requestAuthorization();
            Geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (error) => console.log(error),
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
            );
        } else {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                );
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    Geolocation.getCurrentPosition(
                        (position) => {
                            setLocation({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            });
                        },
                        (error) => console.log(error),
                        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
                    );
                }
            } catch (err) {
                console.warn(err);
            }
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || !userId || loading) return;

        const userMsgText = inputText.trim();
        setInputText('');

        const userMsg = {
            id: Date.now().toString(),
            text: userMsgText,
            sender: 'user',
        };

        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            const response = await sendMessage(userMsgText, location.latitude, location.longitude, userId);

            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: response.response,
                sender: 'bot',
            };

            setMessages((prev) => [...prev, botMsg]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = {
                id: (Date.now() + 1).toString(),
                text: 'Sorry, I encountered an error. Please try again.',
                sender: 'bot',
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => {
        const isUser = item.sender === 'user';
        return (
            <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>
                    {item.text}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with New Chat button */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>FuelFinder</Text>
                <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
                    <Text style={styles.newChatText}>+ New Chat</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Typing indicator when loading */}
            {loading && <TypingIndicator />}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.inputContainer}
            >
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Ask about fuel, parking..."
                        placeholderTextColor="#999"
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                        editable={!loading}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={loading || !inputText.trim()}
                        style={[styles.sendButton, (loading || !inputText.trim()) && styles.sendButtonDisabled]}
                    >
                        <Text style={[styles.sendButtonText, (loading || !inputText.trim()) && styles.sendTextDisabled]}>
                            Send
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    newChatButton: {
        backgroundColor: '#0084ff',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
    },
    newChatText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#0084ff',
        borderBottomRightRadius: 4,
    },
    botBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#e5e5ea',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: '#fff',
    },
    botText: {
        color: '#000',
    },
    typingContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#e5e5ea',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#666',
        marginHorizontal: 3,
    },
    inputContainer: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
        padding: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: '#333',
    },
    sendButton: {
        marginLeft: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendButtonText: {
        color: '#0084ff',
        fontWeight: '600',
        fontSize: 16,
    },
    sendTextDisabled: {
        color: '#999',
    },
});

export default ChatScreen;
