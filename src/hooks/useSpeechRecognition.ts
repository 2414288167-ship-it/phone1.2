import { useState, useRef, useCallback } from "react";

// 定义回调类型
type OnResultCallback = (
  text: string,
  duration: number,
  audioBlob: Blob | null
) => void;

export const useSpeechRecognition = (onResult: OnResultCallback) => {
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const isAbortedRef = useRef<boolean>(false); // 新增：用于标记是否取消

  // 开始录音
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();
      isAbortedRef.current = false; // 重置取消标记

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // 🛑 关键逻辑：如果标记为“取消”，则什么都不做
        if (isAbortedRef.current) {
          console.log("录音已取消，不发送");
          // 停止所有轨道释放麦克风
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        // 正常结束：计算时长并生成 Blob
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // 回调传出数据
        onResult("", duration < 1 ? 1 : duration, audioBlob);

        // 停止轨道
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("无法访问麦克风:", error);
      alert("请允许浏览器访问麦克风");
    }
  }, [onResult]);

  // 正常停止（发送）
  const stopListening = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      isAbortedRef.current = false; // 标记为正常结束
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // 取消录音（不发送）
  const abortListening = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      isAbortedRef.current = true; // 标记为取消
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    startListening, // 对应 InputArea 的调用
    stopListening, // 对应 InputArea 的调用
    abortListening, // 对应 InputArea 的调用
    hasMicrophoneAccess: true,
  };
};
