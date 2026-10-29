import { AccessToken } from 'livekit-server-sdk';

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  isConfigured: boolean;
}

export function getLiveKitConfig(): LiveKitConfig {
  const url = process.env.LIVEKIT_URL || '';
  const apiKey = process.env.LIVEKIT_API_KEY || '';
  const apiSecret = process.env.LIVEKIT_API_SECRET || '';

  return {
    url,
    apiKey,
    apiSecret,
    isConfigured: Boolean(url && apiKey && apiSecret),
  };
}

/**
 * Tạo token JWT để client kết nối vào phòng voice LiveKit WebRTC
 */
export async function createLiveKitToken(
  roomId: string,
  participantId: string,
  participantName: string
): Promise<{ token: string; url: string } | null> {
  const config = getLiveKitConfig();
  if (!config.isConfigured) return null;

  try {
    const at = new AccessToken(config.apiKey, config.apiSecret, {
      identity: participantId,
      name: participantName,
    });

    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return { token, url: config.url };
  } catch (err) {
    console.error('[LiveKit] Lỗi khi tạo token:', err);
    return null;
  }
}

