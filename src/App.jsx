import React, { useState, useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import './App.css';

const App = () => {
  const [room, setRoom] = useState('');
  const [token, setToken] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const chatAreaRef = useRef(null);
  const stompClientRef = useRef(null);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const IamHacker = true; // static for testing

  const getCsrfToken = (e) => {
    e.preventDefault();
    fetch('http://localhost:5000/api/csrf/csrf-token', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(response => response.json())
      .then(data => {
        setCsrfToken(data.token);
      })
      .catch(error => console.error('Error fetching CSRF token:', error));
  };

  const connect = (event) => {
    event.preventDefault();

    console.log("Room before submit: " + room);
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'X-CSRF-TOKEN': csrfToken,
      'Content-Type': 'application/json'
    };

    const socket = new SockJS('http://localhost:5000/ws');
    const stompClient = Stomp.over(socket);
    stompClientRef.current = stompClient;

    stompClient.connect(headers, onConnected, onErrorInConnection);
  };

  const closeSocket = () => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
    }
  };

  const onConnected = () => {
    console.log('Socket connected');

    // for service/controller exceptions
    stompClientRef.current.subscribe('/user/queue/errors', onErrorReceived, {
      'Authorization': `Bearer ${token}`,
      'X-CSRF-TOKEN': csrfToken,
      'Content-Type': 'application/json'
    });
    
    // for interceptors
    stompClientRef.current.subscribe('/topic/error', onErrorReceived, {
      'Authorization': `Bearer ${token}`,
      'X-CSRF-TOKEN': csrfToken,
      'Content-Type': 'application/json'
    });

    stompClientRef.current.subscribe(`/topic/${room}/messagesInReport`, onMessageReceived, {
      'Authorization': `Bearer ${token}`,
      'X-CSRF-TOKEN': csrfToken,
      'Content-Type': 'application/json'
    });
  };

  const onMessageReceived = (payload) => {
    const message = JSON.parse(payload.body);
    console.log('Message received:', message);

    // Determine message direction based on isHacker
    const messageClass = message.isHacker === IamHacker ? 'message-right' : 'message-left';

    setMessages(prevMessages => [...prevMessages, { ...message, direction: messageClass }]);
    scrollToBottom();
  };

  const onErrorReceived = (payload) => {
    console.error('Error Body:', payload.body);

    setError(prev => [...prev, payload.body]);
    scrollToBottom();
  };

  const onErrorInConnection = (frame) => {
    console.error('WebSocket connection error frame:', frame);

    // Check if the frame has a body
    if (frame && frame.body) {
      try {
        // Parse the error message if it's in JSON format
        const errorMessage = JSON.parse(frame.body);
        console.error('Error message body:', errorMessage);
      } catch (e) {
        // If it's not JSON, log the raw body
        console.error('Error message body (raw):', frame.body);
      }
    }

    setConnectionError('Could not connect to WebSocket server. Please refresh this page to try again!');
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (stompClientRef.current ) {
      const chatMessage = {
        isReplied: false,
        content: message.trim(),
        // replyToMessageId: null
      };

      const headers = {
        'Authorization': `Bearer ${token}`,
        'X-CSRF-TOKEN': csrfToken,
        'Content-Type': 'application/json'
      };

      stompClientRef.current.send(`/app/${room}/sendMessageInReport`, headers, JSON.stringify(chatMessage));
      setMessage('');
    }
  };

  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    return () => {
      closeSocket();
    };
  }, []);

  return (
    <div className="App">
      <h4>Default report room: 191ded5d-148b-446d-8069-e8a8bd8c7ec6</h4>
      <div id="login-page">
        <h2>Your access token:</h2>
        <input
          type="text"
          id="token"
          placeholder="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button style={{ margin: '0 10px ' }} type='button' onClick={getCsrfToken}>Get csrf token</button>
        <h2>Your CSRF token:</h2>
        <input
          type="text"
          id="csrfToken"
          placeholder="CSRF Token"
          value={csrfToken}
          onChange={(e) => setCsrfToken(e.target.value)}
          readOnly
        />
        <form id="loginForm" onSubmit={connect}>
          <h2>Room id:</h2>
          <input
            type="text"
            id="room"
            placeholder="Room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <br /> <br />
          <button type="submit">Connect to room in socket</button>
        </form>
        {connectionError && <p>{connectionError}</p>}
      </div>

      <div id="chat-page">
        <h1>Chat Room: {room}</h1>
        <div id="chat-messages" ref={chatAreaRef}>
          {messages.map((msg, index) => (
            <div key={index} className={msg.direction}>
              <p>{msg.content}</p>
            </div>
          ))}
        </div>
        <form id="messageForm" onSubmit={sendMessage}>
          <input
            type="text"
            id="message"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
        <button onClick={closeSocket}>
          Close socket
        </button>
      </div>
    </div>
  );
};

export default App;
