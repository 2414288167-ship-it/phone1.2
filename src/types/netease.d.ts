declare module "NeteaseCloudMusicApi" {
  type CommonParams = {
    cookie?: string;
    headers?: Record<string, string>;
    [key: string]: any;
  };

  export const user_account: (params: CommonParams) => Promise<{
    body: {
      code: number;
      account?: { id: number };
      cookie?: string;
    };
  }>;

  export const user_playlist: (
    params: {
      uid: number;
      limit?: number;
    } & CommonParams
  ) => Promise<{
    body: {
      code: number;
      playlist: Array<{
        id: number;
        name: string;
        creator: { userId: number };
      }>;
    };
  }>;

  export const playlist_track_all: (
    params: {
      id: number;
      limit?: number;
    } & CommonParams
  ) => Promise<{
    body: {
      code: number;
      tracks: any[];
    };
  }>;

  // 补充你用到的其他API（如login_qr_key、login_qr_create、login_qr_check）
  export const login_qr_key: (params: CommonParams) => Promise<{
    body: { data: { unikey: string } };
  }>;

  export const login_qr_create: (
    params: {
      key: string;
      qrimg: boolean;
    } & CommonParams
  ) => Promise<{
    body: { data: { qrimg: string } };
  }>;

  export const login_qr_check: (
    params: {
      key: string;
    } & CommonParams
  ) => Promise<{
    body: { code: number; cookie?: string };
  }>;
}
