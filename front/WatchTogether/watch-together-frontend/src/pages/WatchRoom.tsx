import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, ArrowLeft, Loader2, Send, Smile, X, Users, Play, Power, Pause } from "lucide-react";
import { api, API_BASE_URL, getImageUrl } from "@/services/api";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import { useToast } from "@/hooks/use-toast";
import { STICKERS } from "@/constants/stickers";
import ReactPlayer from 'react-player';

const WatchRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const ReactPlayerAny = ReactPlayer as any;

  // --- REFS ---
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const stompClientRef = useRef<any>(null);

  const isRemoteUpdate = useRef(false);
  const isPlayingRef = useRef(false);

  // Lưu thời gian cần nhảy tới nếu Video chưa kịp load
  const pendingSeekRef = useRef<number | null>(null);

  // --- STATES ---
  const [room, setRoom] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);

  // Video States
  const [videoUrl, setVideoUrl] = useState("");
  const [isYouTube, setIsYouTube] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);

  // --- HÀM COPY ---
  const handleCopyRoomId = () => {
    if (!id) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(id)
          .then(() => toast({ title: "Đã copy mã phòng!" }))
          .catch(() => copyManually(id));
    } else {
      copyManually(id);
    }
  };

  const copyManually = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      toast({ title: "Đã copy mã phòng!" });
    } catch (err) {
      toast({ title: "Lỗi", description: "Trình duyệt chặn copy", variant: "destructive" });
    }
    document.body.removeChild(textArea);
  };

  // Đồng bộ State vào Ref
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // KHỞI TẠO
  useEffect(() => {
    const initData = async () => {
      const userStr = localStorage.getItem("user");
      if (!userStr) { navigate("/login"); return; }
      const user = JSON.parse(userStr);
      setCurrentUser(user);

      try {
        const resRoom = await api.get(`/api/rooms/${id}`);
        setRoom(resRoom.data);

        const rawUrl = resRoom.data.movie?.videoUrl;
        const url = getImageUrl(rawUrl);
        setVideoUrl(url);
        setIsYouTube(url.includes("youtube.com") || url.includes("youtu.be"));

        // Nếu phòng đang chạy, set luôn state để UI hiển thị nút Pause
        if (resRoom.data.isPlaying) {
          setIsPlaying(true);
        }

        try {
          const resChat = await api.get(`/api/rooms/${id}/messages`);
          setChatMessages(resChat.data.map((msg: any) => ({
            type: 'CHAT',
            message: msg.message,
            senderName: msg.user?.username || msg.senderName,
            avatar: msg.user?.avatar || msg.avatar
          })));
        } catch (e) { console.log("Chưa có tin nhắn cũ"); }

        connectSocket(id!, user.username, resRoom.data.host?.username);

      } catch (error) {
        toast({ variant: "destructive", title: "Lỗi", description: "Phòng không tồn tại!" });
        navigate("/rooms");
      } finally {
        setLoading(false);
      }
    };

    if (id) initData();

    return () => {
      if (stompClientRef.current) stompClientRef.current.disconnect();
    };
  }, [id]);

  const connectSocket = (roomCode: string, myUsername: string, hostUsername: string) => {
    const socket = new SockJS(`${API_BASE_URL}/ws`);
    const client = Stomp.over(socket);
    client.debug = () => {};

    client.connect({}, () => {
      stompClientRef.current = client;

      client.subscribe(`/topic/room/${roomCode}`, (payload: any) => {
        const data = JSON.parse(payload.body);
        handleSocketMessage(data, myUsername, hostUsername);
      });

      client.send(`/app/join/${roomCode}`, {}, JSON.stringify({
        type: 'JOIN',
        senderName: myUsername
      }));
    }, (err) => {
      console.error("Socket error", err);
    });
  };

  const handleSocketMessage = (data: any, myUsername: string, hostUsername: string) => {
    if (data.type === 'CHAT') {
      setChatMessages(prev => [...prev, data]);
    }
    else if (data.type === 'COUNT') {
      setOnlineCount(parseInt(data.message));
    }
    else if (['PLAY', 'PAUSE', 'SEEK'].includes(data.type)) {
      if (data.senderName === myUsername) return;
      handleVideoSync(data);
    }
    else if (data.type === 'JOIN') {
      // Logic HOST: Khi có người mới vào
      if (data.senderName !== myUsername && myUsername === hostUsername) {
        //  Delay 1.5 giây để chờ người kia load xong web/video
        setTimeout(() => {
          const currentTime = getCurrentTime();
          const status = isPlayingRef.current ? 'PLAY' : 'PAUSE';
          console.log(`[HOST] User mới vào. Gửi Sync sau delay: ${status} tại ${currentTime}s`);
          sendSyncAction(status, currentTime);
        }, 1500);
      }
    }
    else if (data.type === 'END_ROOM') {
      setIsPlaying(false);
      toast({ title: "Phòng đã kết thúc", description: "Host đã đóng phòng này." });
      navigate("/rooms");
    }
  };

  const getCurrentTime = () => {
    if (isYouTube) return youtubePlayerRef.current?.getCurrentTime() || 0;
    return nativeVideoRef.current?.currentTime || 0;
  };

  const seekTo = (time: number) => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(time, 'seconds');
    }
    else if (nativeVideoRef.current) {
      nativeVideoRef.current.currentTime = time;
    }
  };

  const handleVideoSync = (data: any) => {
    isRemoteUpdate.current = true;

    // Nếu Video chưa sẵn sàng (thời gian hiện tại = 0 và chưa chơi),
    // ta lưu pendingSeekRef để nhảy sau khi load xong.
    const currentTime = getCurrentTime();

    // Nếu thời gian cần nhảy > 0 nhưng player đang ở 0 -> Khả năng cao là mới vào
    if (currentTime < 1 && data.seekTime > 5) {
      console.log("Lưu thời gian chờ nhảy: ", data.seekTime);
      pendingSeekRef.current = data.seekTime;
    }
    // Sync bình thường
    else if (Math.abs(currentTime - data.seekTime) > 1.5) {
      seekTo(data.seekTime);
    }

    if (data.type === 'PLAY') {
      setIsPlaying(true);
      setIsEnded(false);
      // Cố gắng play, nếu lỗi (do chưa user interaction) thì bỏ qua
      if(!isYouTube) nativeVideoRef.current?.play().catch(()=>{});
    } else if (data.type === 'PAUSE') {
      setIsPlaying(false);
      if(!isYouTube) nativeVideoRef.current?.pause();
    }

    setTimeout(() => { isRemoteUpdate.current = false; }, 500);
  };

  //HÀM NÀY SẼ CHẠY KHI PLAYER VỪA LOAD XONG
  const handlePlayerReady = () => {
    console.log("Player Ready/Loaded!");
    // Nếu có lệnh nhảy chờ sẵn, thực hiện ngay
    if (pendingSeekRef.current !== null) {
      console.log("Thực hiện nhảy bù tới: ", pendingSeekRef.current);
      seekTo(pendingSeekRef.current);
      pendingSeekRef.current = null; // Reset
    }
  };

  const sendSyncAction = (type: string, time?: number) => {
    // Nếu đang xử lý update từ server thì không gửi ngược lại
    if (isRemoteUpdate.current && type !== 'PLAY' && type !== 'PAUSE') return;

    // Riêng Host phản hồi JOIN thì luôn được gửi
    if (!stompClientRef.current) return;

    const currentTime = time !== undefined ? time : getCurrentTime();

    stompClientRef.current.send(`/app/sync/${id}`, {}, JSON.stringify({
      type: type,
      seekTime: currentTime,
      senderName: currentUser?.username
    }));
  };

  // --- EVENTS ---
  const onPlay = () => {
    if(!isRemoteUpdate.current) {
      setIsPlaying(true);
      setIsEnded(false);
      sendSyncAction('PLAY');
    }
  };
  const onPause = () => {
    if(!isRemoteUpdate.current) {
      setIsPlaying(false);
      sendSyncAction('PAUSE');
    }
  };
  const onEnded = () => {
    setIsPlaying(false);
    setIsEnded(true);
    sendSyncAction('PAUSE');
  };

  const handleSendMessage = () => {
    if (messageInput.trim() && stompClientRef.current) {
      stompClientRef.current.send(`/app/chat/${id}`, {}, JSON.stringify({
        type: 'CHAT', message: messageInput, senderName: currentUser.username, avatar: currentUser.avatar
      }));
      setMessageInput("");
    }
  };

  const handleSendSticker = (url: string) => {
    if(stompClientRef.current) {
      stompClientRef.current.send(`/app/chat/${id}`, {}, JSON.stringify({
        type: 'CHAT', message: `STICKER|${url}`, senderName: currentUser.username, avatar: currentUser.avatar
      }));
      setShowStickerPicker(false);
    }
  };

  const handleEndRoom = async () => {
    if(!confirm("Bạn có chắc chắn muốn kết thúc phòng?")) return;
    try {
      await api.delete(`/api/rooms/${id}`);
      if(stompClientRef.current) {
        stompClientRef.current.send(`/app/chat/${id}`, {}, JSON.stringify({ type: 'END_ROOM' }));
      }
      navigate("/rooms");
    } catch (e) { toast({title: "Lỗi xóa phòng"}); }
  };

  const isHost = currentUser?.username === room?.host?.username;

  if (loading) return <div className="h-screen flex items-center justify-center bg-black text-white"><Loader2 className="animate-spin mr-2"/> Đang vào phòng...</div>;

  return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        <div className="h-14 border-b px-4 flex items-center justify-between shrink-0 bg-card z-20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/rooms")}><ArrowLeft className="h-5 w-5"/></Button>
            <div>
              <h1 className="font-bold text-sm md:text-base truncate max-w-[200px]">{room?.movie?.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-mono">{room?.roomCode}</Badge>
                <span className="flex items-center text-green-500"><Users className="h-3 w-3 mr-1"/> {onlineCount}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyRoomId}>
            <Copy className="h-4 w-4 mr-2" /> <span className="hidden md:inline">Mời bạn bè</span>
          </Button>
        </div>


        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 bg-black relative flex items-center justify-center group">

            {/* Lớp phủ click interaction ban đầu (Bắt buộc cho AudioContext/AutoPlay) */}
            {!hasInteracted && !isEnded && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center cursor-pointer"
                     onClick={() => {
                       setHasInteracted(true);
                       // Nếu đang có pending seek (do host gửi lệnh tới), thực hiện luôn
                       if (pendingSeekRef.current) {
                         seekTo(pendingSeekRef.current);
                         pendingSeekRef.current = null;
                       }
                       if (isPlaying) {
                         sendSyncAction('PLAY');
                       }
                     }}>
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                    <Play className="h-10 w-10 text-primary ml-1" />
                  </div>
                  <p className="text-white mt-4 font-semibold">
                    {isPlaying ? "Phim đang chiếu. Bấm để xem cùng!" : "Bấm để sẵn sàng"}
                  </p>
                </div>
            )}

            {isEnded && (
                <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center text-white">
                  <h2 className="text-2xl font-bold mb-4">Hết phim</h2>
                  {isHost ? (
                      <div className="flex gap-4">
                        <Button variant="outline" onClick={() => { setIsEnded(false); seekTo(0); sendSyncAction('SEEK', 0); sendSyncAction('PLAY'); }}>
                          <Play className="mr-2 h-4 w-4"/> Xem lại
                        </Button>
                        <Button variant="destructive" onClick={handleEndRoom}>
                          <Power className="mr-2 h-4 w-4"/> Kết thúc phòng
                        </Button>
                      </div>
                  ) : (
                      <p className="text-gray-400">Cảm ơn bạn đã xem!</p>
                  )}
                </div>
            )}

            {/* --- PLAYER YOUTUBE --- */}
            {isYouTube && (
                <ReactPlayerAny
                    ref={youtubePlayerRef}
                    url={videoUrl}
                    width="100%"
                    height="100%"
                    controls={true}
                    playing={isPlaying}
                    onPlay={onPlay}
                    onPause={onPause}
                    onEnded={onEnded}
                    // 👇 QUAN TRỌNG: Khi player sẵn sàng thì check xem có cần nhảy cóc không
                    onReady={handlePlayerReady}
                    onStart={handlePlayerReady}
                    config={{ youtube: { playerVars: { showinfo: 0, rel: 0, modestbranding: 1 } } }}
                />
            )}

            {/* --- PLAYER NATIVE (MP4) --- */}
            {!isYouTube && (
                <video
                    ref={nativeVideoRef}
                    className="w-full h-full object-contain"
                    src={videoUrl}
                    controls
                    // 👇 Sự kiện khi metadata load xong
                    onLoadedMetadata={handlePlayerReady}
                    onPlay={onPlay}
                    onPause={onPause}
                    onEnded={onEnded}
                    onSeeked={() => {
                      if (!isRemoteUpdate.current) sendSyncAction('SEEK');
                    }}
                />
            )}
          </div>

          <Card className="w-80 md:w-96 border-l rounded-none flex flex-col bg-card h-full shrink-0 relative shadow-xl z-30">
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-4">
                {chatMessages.map((msg, i) => {
                  const isMe = msg.senderName === currentUser?.username;
                  const isSticker = msg.message.startsWith("STICKER|");
                  const content = isSticker ? msg.message.split("|")[1] : msg.message;

                  return (
                      <div key={i} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <Avatar className="w-8 h-8 mt-1 border">
                          <AvatarImage src={getImageUrl(msg.avatar)} />
                          <AvatarFallback>{msg.senderName?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <span className="text-[10px] text-muted-foreground mb-1">{msg.senderName}</span>
                          {isSticker ? (
                              <img src={content} alt="sticker" className="w-20 h-20 object-contain hover:scale-110 transition-transform" />
                          ) : (
                              <div className={`px-3 py-2 rounded-lg text-sm break-words ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {content}
                              </div>
                          )}
                        </div>
                      </div>
                  )
                })}
              </div>
            </ScrollArea>
            {showStickerPicker && (
                <div className="absolute bottom-16 left-2 right-2 bg-popover border rounded-lg shadow-lg p-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-semibold">Stickers</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=>setShowStickerPicker(false)}><X className="h-4 w-4"/></Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {STICKERS.map((s, i) => (
                        <img key={i} src={s} className="w-full h-14 object-contain cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors" onClick={() => handleSendSticker(s)} />
                    ))}
                  </div>
                </div>
            )}
            <div className="p-3 border-t bg-card/50 flex gap-2 items-center">
              <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={()=>setShowStickerPicker(!showStickerPicker)}>
                <Smile className="h-5 w-5" />
              </Button>
              <Input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Nhập tin nhắn..."
                  className="flex-1 bg-background"
              />
              <Button size="icon" onClick={handleSendMessage} disabled={!messageInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
  );
};

export default WatchRoom;