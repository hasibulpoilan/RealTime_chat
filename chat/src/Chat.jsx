import { useContext, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { UserContext } from "./UserContext";
import { uniqBy } from 'lodash'; 
import axios from 'axios';
import Contact from "./Contact";

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const { username, id, setId, setUsername } = useContext(UserContext);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const divUnderMessages = useRef();
    const [selectedUserName, setSelectedUserName] = useState('');
    const [isCallActive, setIsCallActive] = useState(false);
    const [callType, setCallType] = useState(null); 
    const [peerConnection, setPeerConnection] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [unreadMessages, setUnreadMessages] = useState({});
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        const connectWebSocket = () => {
            connectToWs();
        };

        function connectToWs() {
            const wsInstance = new WebSocket('ws://localhost:4000');
            setWs(wsInstance);
            wsInstance.addEventListener('message', handleMessage);
            wsInstance.addEventListener('close', () => {
                setTimeout(() => {
                    console.log('Disconnected. Trying to reconnect.');
                    connectToWs();
                }, 1000);
            });
        }

        connectWebSocket(); 

        return () => {
            if (ws) {
                ws.removeEventListener('message', handleMessage); 
                ws.close(); 
            }
        };
    }, []);

    const handleSelectUser = (userId, userName) => {
        setSelectedUserId(userId);
        setSelectedUserName(userName);
        setUnreadMessages((prev) => ({
            ...prev,
            [userId]: 0,
        }));
    };

    function showOnLinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username;
        });
        setOnlinePeople(people);  
    }

    function handleMessage(ev) {
        const messageData = JSON.parse(ev.data);
        console.log("Received message data:", messageData);
    
        if ('online' in messageData) {
            showOnLinePeople(messageData.online);
        } else if ('text' in messageData || 'file' in messageData) {
            const { sender } = messageData;
    
            setMessages((prev) => [...prev, messageData]);
    
            if (sender !== selectedUserId) {
                setUnreadMessages((prev) => ({
                    ...prev,
                    [sender]: (prev[sender] || 0) + 0.5,
                }));
            }
        } else if ('offline' in messageData) {
            removeOfflinePerson(messageData.offlineUserId);
        }
    }
    
    function removeOfflinePerson(userId) {
        setOfflinePeople(prev => prev.filter(person => person.id !== userId));
    }

    function sendMessage(ev, file = null) {
        if (ev) ev.preventDefault();

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                recipient: selectedUserId,
                text: newMessageText,
                file,
            }));
        } else {
            console.log("WebSocket is not open. Cannot send message.");
        }

        console.log(newMessageText);

        setNewMessageText('');

        setMessages(prev => ([...prev, {
            text: newMessageText,
            recipient: selectedUserId,
            sender: id,
            id: Date.now(),
            file: file ? file.name : null,
        }]));
    }

    function sendFile(ev) {
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => {
            sendMessage(null, {
                name: ev.target.files[0].name,
                data: reader.result.split(',')[1],
            });
        }
    }

    function logout() {
        axios.post('http://localhost:4000/logout', {}, { withCredentials: true })  
            .then(() => {
                setWs(null);
                setId(null);
                setUsername(null);
            })
            .catch(err => {
                console.error("Error during logout:", err);
            });
    }

    useEffect(() => {
        const div = divUnderMessages.current;
        if (div) {
            div.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages])

    useEffect(() => {
        if (selectedUserId) {
            axios.get(`http://localhost:4000/messages/${selectedUserId}`, { withCredentials: true })
                .then(res => {
                    console.log("Fetched messages:", res.data);
                    setMessages(res.data);
                })
                .catch(err => {
                    console.error("Error fetching messages:", err.response.data); 
                });
        }
    }, [selectedUserId]);

    useEffect(() => {
        axios.get('http://localhost:4000/people', { withCredentials: true })
            .then(res => {
                console.log("Full response from /people:", res);
                if (Array.isArray(res.data)) {
                    const offlinePeopleArr = res.data
                        .filter(p => p.id !== id)
                        .filter(p => !Object.keys(onlinePeople).includes(p.id.toString()));
                    setOfflinePeople(offlinePeopleArr);
                } else {
                    console.error("Unexpected response data:", res.data);
                }
            })
            .catch(err => {
                console.error("Error fetching people:", err);
            });
    }, [onlinePeople, id]);

    async function handleDeleteMessage(messageId) {
        try {
            const response = await axios.delete(`http://localhost:4000/messages/${messageId}`, {
                withCredentials: true,
            });
            if (response.data.success) {
                setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
            } else {
                console.error("Delete failed on backend:", response.data.message);
            }
        } catch (err) {
            console.error("Failed to delete the message:", err);
        }
    }

    async function deleteUser(userId, listType) {
        try {
            const response = await axios.delete(`http://localhost:4000/users/${userId}`, {
                withCredentials: true,
            });

            if (response.data.success) {
                if (listType === 'online') {
                    setOnlinePeople(prev => {
                        const updatedOnlinePeople = { ...prev };
                        delete updatedOnlinePeople[userId];  
                        return updatedOnlinePeople;
                    });
                } else if (listType === 'offline') {
                    setOfflinePeople(prev => prev.filter(person => person.id !== userId));
                }
            } else {
                console.error("Failed to delete user:", response.data.message);
                alert('Error: ' + response.data.message);
            }
        } catch (err) {
            console.error("Error deleting user:", err);
            alert('Error: Failed to delete user');
        }
    }

    function startCall(isVideo) {
        setIsCallActive(true);
        setCallType(isVideo ? 'video' : 'audio');

        const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const pc = new RTCPeerConnection(config);
        setPeerConnection(pc);

        pc.ontrack = (event) => {
            const [stream] = event.streams;
            setRemoteStream(stream);
            remoteVideoRef.current.srcObject = stream;
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    recipient: selectedUserId,
                }));
            }
        };

        const mediaConstraints = {
            video: isVideo,
            audio: true,
        };

        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then((stream) => {
                setLocalStream(stream);
                localVideoRef.current.srcObject = stream;
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));
            })
            .catch((err) => {
                console.error("Error accessing media devices.", err);
                alert("Could not access your camera and/or microphone.");
                setIsCallActive(false);
            });

        pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
                ws.send(JSON.stringify({
                    type: 'offer',
                    offer: pc.localDescription,
                    recipient: selectedUserId,
                }));
            })
            .catch((err) => {
                console.error("Error creating offer:", err);
                setIsCallActive(false);
            });
    }

    function endCall() {
        if (peerConnection) {
            peerConnection.close();
            setPeerConnection(null);
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            setRemoteStream(null);
        }
        setIsCallActive(false);
        setCallType(null);
    }

    useEffect(() => {
        if (ws && peerConnection) {
            ws.onmessage = async (messageEvent) => {
                const data = JSON.parse(messageEvent.data);

                if (data.type === 'offer') {
                    handleOffer(data.offer);
                } else if (data.type === 'answer') {
                    handleAnswer(data.answer);
                } else if (data.type === 'ice-candidate') {
                    handleIceCandidate(data.candidate);
                }

                if ('online' in data) {
                    showOnLinePeople(data.online);
                } else if ('text' in data || 'file' in data) {
                    setMessages(prev => ([...prev, data]));
                }
                if ('offline' in data) {
                    removeOfflinePerson(data.offlineUserId);
                }
            };
        }
    }, [ws, peerConnection]);

    async function handleOffer(offer) {
        if (!peerConnection) {
            startCall(offer.type === 'video');
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({
            type: 'answer',
            answer: peerConnection.localDescription,
            recipient: selectedUserId,
        }));
    }

    async function handleAnswer(answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    function handleIceCandidate(candidate) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(err => console.error("Error adding received ICE candidate", err));
    }

    async function saveMessage(sender, recipient, text, file) {
        const query = `
            INSERT INTO messagess (sender, recipient, text, file)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [sender, recipient, text, file];

        try {
            const res = await pool.query(query, values);
            console.log('Message saved:', res.rows[0]);
            return res.rows[0];
        } catch (err) {
            console.error('Error saving message:', err);
        }
    }

    const onlinePeopleExclOurUser = { ...onlinePeople };
    delete onlinePeopleExclOurUser[id.toString()]; 

    const messageWithoutDupes = uniqBy(messages, 'id');
    console.log("Rendering messages:", messageWithoutDupes);




    return (
        <div className="flex h-screen bg-gray-100">
            <div className="bg-white w-1/3 p-4 border-r-2 border-gray-200 flex flex-col">
                <div><Logo /></div>
                <div className="flex-grow overflow-y-scroll no-scrollbar">
                    {Object.keys(onlinePeopleExclOurUser).map(userId => (
                        <div key={userId} className="flex justify-between">
                            <Contact
                                key={userId}
                                id={userId}
                                online={true}
                                username={onlinePeopleExclOurUser[userId]}
                                onClick={() => handleSelectUser(userId, onlinePeopleExclOurUser[userId])} 
                                selected={userId === selectedUserId}
                            />
                            <div className="items-center flex">
                            {unreadMessages[userId] > 0 && (
                                <span className="bg-blue-500 text-white text-xs font-semibold px-2 w-6 h-6 relative rounded-full flex items-center mr-2">
                                    {unreadMessages[userId]}
                                </span>
                            )}
                            </div>
                            <button
                                onClick={() => deleteUser(userId, 'online')}
                                className="text-red-500 text-xs "
                            >
                                
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>

                            </button>
                             
                        </div>
                    ))}
                    {offlinePeople.map(user => (
                        <div key={user.id} className="flex justify-between">
                            <Contact
                                id={user.id}
                                online={false}
                                username={user.username}
                                onClick={() => {
                                    setSelectedUserId(user.id);
                                    setSelectedUserName(user.username);
                                }}
                                selected={user.id === selectedUserId}
                            />
                            <button
                                onClick={() => deleteUser(user.id, 'offline')} 
                                className="text-red-500 text-xs"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>



                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-2 user-info text-center items-center flex justify-evenly">
                    <span className="mr-2 text-md flex items-center text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                        {username}
                    </span>
                    <button onClick={logout} className="logout-button text-md text-blue-600 bg-blue-100 py-1 px-2 border rounded-sm">
                        Logout
                    </button>
                </div>
            </div>

            <div className="bg-blue-100 w-2/3 p-4 flex flex-col ">
                {isCallActive && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-4 rounded-md shadow-lg flex flex-col items-center">
                            <h2 className="text-lg font-semibold mb-4">
                                {callType === 'video' ? 'Video Call' : 'Audio Call'}
                            </h2>

                            <div className="flex space-x-4">
                                {callType === 'video' && (
                                    <video ref={localVideoRef} autoPlay muted className="w-32 h-24 border rounded-md" />
                                )}
                                {callType === 'video' && (
                                    <video ref={remoteVideoRef} autoPlay className="w-32 h-24 border rounded-md" />
                                )}
                                {callType === 'audio' && (
                                    <div className="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 text-green-500">
                                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={endCall}
                                className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                            >
                                End Call
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-grow overflow-hidden">
                    {!!selectedUserId &&
                        <div className="bg-white p-2 rounded-t-md border-b border-gray-300 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-700 truncate">
                                {onlinePeople[selectedUserId] || offlinePeople.find(p => p.id === selectedUserId)?.username}
                            </h2>
                            <div className="flex space-x-4 items-center">
                                <div onClick={() => startCall(true)} className="cursor-pointer">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-blue-500 hover:text-blue-700">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                                    </svg>
                                </div>

                                <div onClick={() => startCall(false)} className="cursor-pointer">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-green-500 hover:text-green-700">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    }

                    {!selectedUserId && (
                        <div className="flex h-full flex-grow items-center justify-center">
                            <div className="text-gray-400">&larr; Select a person from the sidebar</div>
                        </div>
                    )}

                    {!!selectedUserId && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2 p-4 no-scrollbar">
                                {messageWithoutDupes.map((message, index) => (
                                    <div key={message.id} className={message.sender === id ? 'text-right' : 'text-left'}>
                                        <div className={`inline-block p-2 my-2 rounded-md text-sm ${message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'}`}>
                                            {message.text && <p>{message.text}</p>}

                                            {message.file && (
                                                <div className="mt-2 flex items-center">
                                                    <a className="flex items-center gap-1 border-b" href={`http://localhost:4000/uploads/${message.file}`} target="_blank" rel="noopener noreferrer">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 flex">
                                                            <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="text-white-500 ">{message.file}</span>
                                                    </a>
                                                </div>
                                            )}
                                           
                                            <button
                                                onClick={() => handleDeleteMessage(message.id)}
                                                className="text-red-500 text-xs mt-1"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>

                {!!selectedUserId && (
                    <form className="flex gap-2" onSubmit={sendMessage}>
                        <input type="text"
                            value={newMessageText}
                            onChange={ev => setNewMessageText(ev.target.value)}
                            placeholder="Type your message here" className="bg-white border border-gray-300 p-2 flex-grow rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-500"
                        />

                        <label className="bg-blue-200 p-2 text-gray-600 rounded-sm border border-blue-200 cursor-pointer">
                            <input type="file" className="hidden" onChange={sendFile} />
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" />
                            </svg>
                        </label>

                        <button type="submit" className="bg-blue-500 p-2 text-white rounded-md shadow-sm hover:bg-blue-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
