export {}

declare global {
  interface TelegramUser {
    id: number
    is_bot?: boolean
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    is_premium?: boolean
    added_to_attachment_menu?: boolean
    allows_write_to_pm?: boolean
    photo_url?: string
  }

  interface TelegramWebApp {
    initData: string
    initDataUnsafe: {
      user?: TelegramUser
      chat?: any
      auth_date?: string
      query_id?: string
      start_param?: string
      hash?: string
    }
    version: string
    platform: string
    colorScheme: 'light' | 'dark'
    themeParams: {
      bg_color?: string
      text_color?: string
      hint_color?: string
      link_color?: string
      button_color?: string
      button_text_color?: string
      secondary_bg_color?: string
      header_bg_color?: string
      bottom_bar_bg_color?: string
    }
    isExpanded: boolean
    viewportHeight: number
    viewportStableHeight: number
    isClosingConfirmationEnabled: boolean
    ready(): void
    expand(): void
    close(): void
    onEvent(eventType: string, callback: () => void): void
    offEvent(eventType: string, callback: () => void): void
    setBackgroundColor(color: string): void
    setHeaderColor(color: string): void
    MainButton: {
      text: string
      color: string
      textColor: string
      isVisible: boolean
      isActive: boolean
      isProgressVisible: boolean
      setText(text: string): void
      show(): void
      hide(): void
      enable(): void
      disable(): void
      showProgress(leaveActive?: boolean): void
      hideProgress(): void
      onClick(callback: () => void): void
      offClick(callback: () => void): void
    }
    BackButton: {
      isVisible: boolean
      show(): void
      hide(): void
      onClick(callback: () => void): void
      offClick(callback: () => void): void
    }
  }

  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
  }
}

