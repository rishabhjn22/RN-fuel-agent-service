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
    ActivityIndicator,
    PermissionsAndroid, // Added for Android permission
} from 'react-native';
import { sendMessage } from '../api/agent';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation'; // Import Geolocation

const ChatScreen = () => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState({ latitude: 0, longitude: 0 }); // Location state
    const flatListRef = useRef(null);

    useEffect(() => {
        requestLocationPermission();
        // Initial welcome message
        setMessages([
            {
                id: '1',
                text: 'Hello! I can help you find fuel, parking, and amenities. Where are you?',
                sender: 'bot',
                timestamp: new Date(),
            },
        ]);
    }, []);

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
                    {
                        title: 'Location Permission',
                        message: 'Fuel Agent needs access to your location to find stations.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
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
                } else {
                    console.log('Location permission denied');
                }
            } catch (err) {
                console.warn(err);
            }
        }
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userMsgText = inputText.trim();
        setInputText('');

        // Add user message
        const userMsg = {
            id: Date.now().toString(),
            text: userMsgText,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            // Backend call uses actual location
            console.log('Sending location:', location);
            const response = await sendMessage(userMsgText, location.latitude, location.longitude);

            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: response.response,
                sender: 'bot',
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, botMsg]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = {
                id: (Date.now() + 1).toString(),
                text: 'Sorry, I encountered an error. Please try again.',
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => {
        const isUser = item.sender === 'user';
        return (
            <View
                style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.botBubble,
                ]}
            >
                <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>
                    {item.text}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Fuel Agent</Text>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#0084ff" />
                    <Text style={styles.loadingText}>Agent is typing...</Text>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                style={styles.inputContainer}
            >
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type a message..."
                        placeholderTextColor="#999"
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                    />
                    <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                        <Text style={styles.sendButtonText}>Send</Text>
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
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
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
    loadingContainer: {
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 16,
        marginBottom: 8,
    },
    loadingText: {
        marginLeft: 8,
        color: '#666',
        fontSize: 12,
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
        maxHeight: 100,
        color: '#333',
    },
    sendButton: {
        marginLeft: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    sendButtonText: {
        color: '#0084ff',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default ChatScreen;
