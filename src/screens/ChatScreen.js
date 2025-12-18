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

// Try to load optional dependencies
let RNFS = null;
try {
    RNFS = require('react-native-fs');
} catch (e) {
    console.log('react-native-fs not installed');
}

// Try to load nitro-sound (singleton - use directly)
let Sound = null;
try {
    Sound = require('react-native-nitro-sound').default;
} catch (e) {
    console.log('react-native-nitro-sound not installed - voice disabled');
}

// Typing indicator
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

// Recording indicator
const RecordingIndicator = () => {
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
            ])
        ).start();
    }, [pulse]);

    return (
        <View style={styles.recordingContainer}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulse }] }]} />
            <Text style={styles.recordingText}>Recording... Tap ⏹️ to stop</Text>
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
    const [location, setLocation] = useState(null); // null until we have GPS
    const [userId, setUserId] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [currentAudioPath, setCurrentAudioPath] = useState(null);

    const flatListRef = useRef(null);

    // Check if voice is available
    useEffect(() => {
        if (Sound && Sound.startRecorder) {
            setVoiceEnabled(true);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (Sound) {
                Sound.stopPlayer?.();
                Sound.stopRecorder?.();
                Sound.removePlayBackListener?.();
                Sound.removeRecordBackListener?.();
            }
        };
    }, []);

    // Get or create userId
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

    const handleNewChat = async () => {
        const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await AsyncStorage.setItem('fuel_user_id', newId);
        setUserId(newId);
        setMessages([{ ...WELCOME_MESSAGE, id: Date.now().toString() }]);
    };

    // Get current GPS location
    const getCurrentLocation = () => {
        return new Promise((resolve, reject) => {
            Geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                    console.log('📍 GPS Location:', loc);
                    setLocation(loc);
                    resolve(loc);
                },
                (err) => {
                    console.log('❌ GPS Error:', err);
                    reject(err);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
            );
        });
    };

    const requestLocationPermission = async () => {
        try {
            if (Platform.OS === 'ios') {
                Geolocation.requestAuthorization();
            } else {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('❌ Location permission denied');
                    return;
                }
            }
            await getCurrentLocation();
        } catch (err) {
            console.log('❌ Location error:', err);
        }
    };

    const requestMicPermission = async () => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
    };

    const recordingStartTime = useRef(null);
    const isRecordingRef = useRef(false); // Track recording state reliably
    const MIN_RECORDING_MS = 1000; // Minimum 1 second recording

    // Start voice recording
    const startRecording = async () => {
        if (!Sound || isRecordingRef.current) return;

        const hasPermission = await requestMicPermission();
        if (!hasPermission) {
            console.log('Mic permission denied');
            return;
        }

        try {
            Sound.addRecordBackListener((e) => {
                console.log('Recording:', e.currentPosition);
            });

            const result = await Sound.startRecorder();
            console.log('Recording started:', result);
            setCurrentAudioPath(result);
            setIsRecording(true);
            isRecordingRef.current = true;
            recordingStartTime.current = Date.now();
        } catch (e) {
            console.error('Start recording error:', e);
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    };

    // Stop recording and send
    const stopRecording = async () => {
        if (!Sound || !isRecordingRef.current) {
            console.log('Not recording, skipping stop');
            return;
        }

        const elapsed = Date.now() - (recordingStartTime.current || 0);
        console.log(`Recording duration: ${elapsed}ms`);

        // If too short, wait until minimum time
        if (elapsed < MIN_RECORDING_MS) {
            const waitTime = MIN_RECORDING_MS - elapsed;
            console.log(`Recording too short, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Now stop
        try {
            isRecordingRef.current = false; // Mark as not recording BEFORE stopping
            const audioPath = await Sound.stopRecorder();
            Sound.removeRecordBackListener();
            console.log('Recording stopped:', audioPath);
            setIsRecording(false);
            recordingStartTime.current = null;

            if (audioPath) {
                await handleSendMessage({ audioUri: audioPath, voiceResponse: true });
            }
        } catch (e) {
            console.error('Stop recording error:', e);
            setIsRecording(false);
            isRecordingRef.current = false;
            recordingStartTime.current = null;
            
            // If stop failed but we have a path, try sending anyway
            if (currentAudioPath) {
                console.log('Trying to send with existing path:', currentAudioPath);
                await handleSendMessage({ audioUri: currentAudioPath, voiceResponse: true });
            }
        }
    };

    // Play audio from base64
    const playAudio = async (base64Audio) => {
        if (!Sound || !base64Audio || !RNFS) {
            console.log('Audio playback not available');
            return;
        }

        try {
            // Stop any current playback
            await Sound.stopPlayer();
            
            // Save base64 to temp file
            const path = `${RNFS.CachesDirectoryPath}/response_${Date.now()}.mp3`;
            await RNFS.writeFile(path, base64Audio, 'base64');

            // Set up playback listeners
            Sound.addPlayBackListener((e) => {
                console.log('Playback:', e.currentPosition, '/', e.duration);
            });

            Sound.addPlaybackEndListener(() => {
                console.log('Playback ended');
                setIsPlaying(false);
                Sound.removePlayBackListener();
                Sound.removePlaybackEndListener();
            });

            // Start playback
            setIsPlaying(true);
            await Sound.startPlayer(path);
        } catch (e) {
            console.error('Playback error:', e);
            setIsPlaying(false);
        }
    };

    // Stop audio playback
    const stopAudio = async () => {
        if (!Sound) return;
        try {
            await Sound.stopPlayer();
            Sound.removePlayBackListener();
            Sound.removePlaybackEndListener();
            setIsPlaying(false);
        } catch (e) {
            console.error('Stop playback error:', e);
        }
    };

    // Unified send handler
    const handleSendMessage = async ({ text: inputMsg, audioUri, voiceResponse = false }) => {
        if (!userId) return;

        const msgText = inputMsg?.trim();
        if (!msgText && !audioUri) return;

        // Use cached location, fallback to default if not available
        const currentLoc = location || { latitude: 37.3382, longitude: -121.8863 };
        console.log('📤 Using location:', currentLoc);

        // Add user message
        const userMsgId = Date.now().toString();
        setMessages(prev => [...prev, {
            id: userMsgId,
            text: audioUri ? '🎤 Voice message...' : msgText,
            sender: 'user',
        }]);

        if (!audioUri) setInputText('');
        setLoading(true);

        try {
            const result = await sendMessage({
                user_id: userId,
                latitude: currentLoc.latitude,
                longitude: currentLoc.longitude,
                text: msgText,
                audioUri,
                voiceResponse,
            });

            // Update user message with transcription if voice
            if (result.transcription) {
                setMessages(prev => prev.map(msg =>
                    msg.id === userMsgId ? { ...msg, text: result.transcription } : msg
                ));
            }

            // Add bot response
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: result.response,
                sender: 'bot',
                audio: result.audio,
            }]);

            // Auto-play audio if available
            if (result.audio) {
                playAudio(result.audio);
            }

        } catch (e) {
            console.error('Send error:', e);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: 'Sorry, something went wrong.',
                sender: 'bot',
            }]);
        } finally {
            setLoading(false);
        }
    };

    // Text send handler
    const handleSend = () => {
        if (inputText.trim()) {
            handleSendMessage({ text: inputText });
        }
    };

    const renderItem = ({ item }) => {
        const isUser = item.sender === 'user';
        return (
            <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>
                    {item.text}
                </Text>
                {item.audio && (
                    <TouchableOpacity
                        onPress={() => isPlaying ? stopAudio() : playAudio(item.audio)}
                        style={styles.playButton}
                    >
                        <Text style={styles.playIcon}>{isPlaying ? '⏹️' : '🔊'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
            >
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
                    keyboardShouldPersistTaps="handled"
                />

                {isRecording && <RecordingIndicator />}
                {loading && !isRecording && <TypingIndicator />}

                <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                        {voiceEnabled && (
                            <TouchableOpacity
                                onPress={isRecording ? stopRecording : startRecording}
                                disabled={loading}
                                style={[styles.micButton, isRecording && styles.micButtonActive]}
                            >
                                <Text style={styles.micIcon}>{isRecording ? '⏹️' : '🎤'}</Text>
                            </TouchableOpacity>
                        )}

                        <TextInput
                            style={styles.textInput}
                            placeholder={voiceEnabled ? "Type or tap 🎤" : "Type a message..."}
                            placeholderTextColor="#999"
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={handleSend}
                            editable={!loading && !isRecording}
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
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    keyboardAvoid: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    newChatButton: { backgroundColor: '#0084ff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
    newChatText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    listContent: { padding: 16, paddingBottom: 24 },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: '#0084ff', borderBottomRightRadius: 4 },
    botBubble: { alignSelf: 'flex-start', backgroundColor: '#e5e5ea', borderBottomLeftRadius: 4 },
    messageText: { fontSize: 16, lineHeight: 22 },
    userText: { color: '#fff' },
    botText: { color: '#000' },
    playButton: { marginTop: 6 },
    playIcon: { fontSize: 18 },
    typingContainer: { paddingHorizontal: 16, paddingBottom: 8 },
    typingBubble: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        backgroundColor: '#e5e5ea',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
    },
    typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#666', marginHorizontal: 3 },
    recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: '#fff3f3',
    },
    recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff3b30', marginRight: 8 },
    recordingText: { color: '#ff3b30', fontWeight: '600' },
    inputContainer: { borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff', padding: 8 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center' },
    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    micButtonActive: { backgroundColor: '#ffebee' },
    micIcon: { fontSize: 20 },
    textInput: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: '#333',
    },
    sendButton: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8 },
    sendButtonDisabled: { opacity: 0.5 },
    sendButtonText: { color: '#0084ff', fontWeight: '600', fontSize: 16 },
    sendTextDisabled: { color: '#999' },
});

export default ChatScreen;
