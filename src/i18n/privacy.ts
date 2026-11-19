// The privacy policy, per language. English is the reference; the translations say so.
// Keep it in step with what the app actually does (see README and firestore.rules).
import type { Lang } from '.';

export interface PrivacyPolicy {
  title: string;
  /** Shown on translations only: which version applies if they differ. */
  prevails?: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export function privacyPolicy(lang: Lang): PrivacyPolicy {
  return POLICIES[lang];
}

const POLICIES: Record<Lang, PrivacyPolicy> = {
  en: {
    title: 'Privacy',
    intro: 'PartyGames is a hobby app for a small group of friends.',
    sections: [
      {
        heading: 'What is stored',
        paragraphs: [
          "When you sign in with Google, the app stores your Google account's name, email address and profile picture, plus when you first and last opened the app and how many times. That is what lets the admin see who uses the app and manage access.",
          'While you are in a game room, the room holds your name and picture, the moves or money transfers in that game, and a timestamp showing your device is still connected. A room is deleted as soon as everybody has left it, and everything in it goes with it.',
        ],
      },
      {
        heading: 'What is not stored',
        paragraphs: [
          'No analytics, no advertising, no trackers, no third-party scripts. Nothing is sold or shared. Your Google password is never seen by this app — sign-in is handled by Google.',
        ],
      },
      {
        heading: 'Deleting your data',
        paragraphs: [
          "Sign out and ask the admin to remove your account. That deletes your record and your rooms. You can also remove the app's access to your Google account at any time from your Google account settings.",
        ],
      },
      {
        heading: 'Where it runs',
        paragraphs: [
          "The app is hosted on Firebase (Google Cloud) and its data lives in Firestore. The app is written so the storage layer can be swapped for another provider or a self-hosted server; see the project's README.",
        ],
      },
    ],
  },
  zh: {
    title: '隐私',
    prevails: '本页为英文版的翻译；如两者有出入，以英文版为准。',
    intro: 'PartyGames 是为一小群朋友做的业余应用。',
    sections: [
      {
        heading: '保存了什么',
        paragraphs: [
          '用 Google 登录时，应用会保存你 Google 账号的名字、邮箱和头像，以及你第一次和最近一次打开应用的时间、打开的次数。管理员靠这些了解谁在使用、管理访问权限。',
          '你在游戏房间里时，房间会保存你的名字和头像、这局游戏里的走棋或转账，以及一个表示你的设备仍在线的时间戳。所有人离开后房间会立即删除，里面的一切也随之删除。',
        ],
      },
      {
        heading: '不保存什么',
        paragraphs: [
          '没有统计分析、没有广告、没有追踪器、没有第三方脚本。不出售、不分享任何东西。应用看不到你的 Google 密码——登录由 Google 处理。',
        ],
      },
      {
        heading: '删除你的数据',
        paragraphs: [
          '退出登录，并请管理员移除你的账号。这会删除你的记录和你的房间。你也可以随时在 Google 账号设置里取消本应用对你账号的访问权限。',
        ],
      },
      {
        heading: '运行在哪里',
        paragraphs: [
          '应用托管在 Firebase（Google Cloud）上，数据存放在 Firestore。应用的写法让存储层可以换成其他服务商或自建服务器，详见项目的 README。',
        ],
      },
    ],
  },
  ja: {
    title: 'プライバシー',
    prevails: 'このページは英語版の翻訳です。内容に違いがある場合は英語版が優先されます。',
    intro: 'PartyGames は、少人数の友だち向けに作った趣味のアプリです。',
    sections: [
      {
        heading: '保存するもの',
        paragraphs: [
          'Google でサインインすると、Google アカウントの名前・メールアドレス・プロフィール写真と、アプリを最初と最後に開いた日時、開いた回数を保存します。管理者が利用者を把握し、アクセスを管理するためのものです。',
          'ゲームルームにいる間、ルームにはあなたの名前と写真、そのゲームでの手やお金のやり取り、そして端末がまだ接続していることを示すタイムスタンプが保存されます。全員が退出するとルームはすぐに削除され、中身もすべて消えます。',
        ],
      },
      {
        heading: '保存しないもの',
        paragraphs: [
          'アクセス解析、広告、トラッカー、外部スクリプトは一切ありません。何も販売・共有しません。Google のパスワードがこのアプリに見えることはありません（サインインは Google が行います）。',
        ],
      },
      {
        heading: 'データの削除',
        paragraphs: [
          'サインアウトして、管理者にアカウントの削除を頼んでください。あなたの記録とルームが削除されます。Google アカウントの設定から、このアプリのアクセスをいつでも取り消すこともできます。',
        ],
      },
      {
        heading: '動いている場所',
        paragraphs: [
          'アプリは Firebase（Google Cloud）でホストされ、データは Firestore にあります。保存先は別のサービスや自前のサーバーに差し替えられるように作ってあります。詳しくはプロジェクトの README をご覧ください。',
        ],
      },
    ],
  },
};
