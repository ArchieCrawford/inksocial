const terms = {
    inkPrintSingular: 'Ink Print',
    inkPrintPlural: 'Ink Prints',
    printing: 'Printing',
    printVerb: 'Print',
    reprint: 'Reprint',
    stream: 'Ink Stream',
    printer: 'Printer'
};

const pluralize = (count, singular, plural) => (count === 1 ? singular : plural);

export const copy = {
    terms,
    appName: 'InkSocial',
    tagline: 'The production-ready social layer for Ink Network. Own your identity, sign your data.',
    actions: {
        connectWallet: 'Connect Ink Wallet',
        claimProfile: 'Register on Ink Network (Gas)',
        cancel: 'Cancel',
        logout: 'Logout',
        confirmTx: 'Confirming Transaction...',
        reply: 'Reply',
        print: terms.printVerb
    },
    landing: {
        title: 'InkSocial',
        description: 'The production-ready social layer for Ink Network. Own your identity, sign your data.'
    },
    registration: {
        title: 'Claim your Ink Profile',
        description: 'Choose a unique handle on Ink Network. This requires a one-time gas transaction.',
        usernameLabel: 'Handle',
        usernamePlaceholder: 'e.g. ink_pioneer'
    },
    nav: {
        feed: 'Feed',
        search: 'Search',
        tokens: 'Tokens',
        notifications: 'Alerts',
        profile: 'Profile'
    },
    headers: {
        streams: `${terms.stream}s`,
        feedTitle: terms.inkPrintPlural,
        notifications: 'Notifications',
        profilePrints: terms.inkPrintPlural
    },
    feed: {
        empty: `No ${terms.inkPrintPlural.toLowerCase()} found in this ${terms.stream.toLowerCase()}.`
    },
    thread: {
        back: terms.inkPrintSingular,
        reprints: 'Reprints',
        likes: 'Likes'
    },
    search: {
        placeholder: `Search ${terms.printer.toLowerCase()}s or ${terms.inkPrintPlural.toLowerCase()}...`,
        empty: 'No results found.'
    },
    tokens: {
        title: 'Token Search',
        helper: 'Find Ink Network tokens by symbol, name, or address.',
        placeholder: 'Search tokens (symbol, name, address)',
        empty: 'No tokens found.',
        emptyState: 'Start typing to search Ink Network tokens.',
        loading: 'Loading tokens...',
        searching: 'Searching...',
        error: 'Unable to search tokens right now.',
        noTrending: 'No trending data yet. Showing recent tokens.',
        verified: 'Verified',
        select: 'Select token',
        view: 'View',
        loadMore: 'Load more',
        selectedTitle: 'Selected token',
        unknownSymbol: 'Unknown',
        unknownName: 'Unnamed token',
        selectedToastTitle: 'Token selected',
        tabs: {
            trending: 'Trending',
            recent: 'Recent'
        },
        recentSearchesTitle: 'Recent searches',
        recentSearchesEmpty: 'No recent searches yet.',
        marketUnavailable: 'Market data unavailable',
        market: {
            price: 'Price',
            change: '24h change',
            marketCap: 'Market cap',
            volume: '24h volume',
            chartTitle: 'Price history',
            chartLoading: 'Loading chart…',
            chartEmpty: 'No chart data yet.',
            chartUnavailable: 'Market data unavailable'
        }
    },
    notifications: {
        empty: 'No notifications yet.',
        like: `liked your ${terms.inkPrintSingular.toLowerCase()}`,
        reprint: `reprinted your ${terms.inkPrintSingular.toLowerCase()}`,
        reply: `replied to your ${terms.inkPrintSingular.toLowerCase()}`
    },
    composer: {
        placeholder: `Write an ${terms.inkPrintSingular.toLowerCase()}...`,
        replyPlaceholder: 'Write your reply...',
        barPlaceholder: `Write an ${terms.inkPrintSingular.toLowerCase()}...`
    },
    profile: {
        followers: 'Followers',
        following: 'Following',
        printsCount: (count) => `${count} ${pluralize(count, terms.inkPrintSingular, terms.inkPrintPlural)}`,
        settings: 'Settings'
    },
    settings: {
        title: 'Profile Settings',
        editProfile: 'Edit Profile',
        save: 'Save changes',
        saving: 'Saving...',
        sections: {
            visuals: 'Visuals',
            identity: 'Identity',
            about: 'About you',
            optional: 'Optional'
        },
        fields: {
            displayName: 'Display name',
            username: 'Username',
            bio: 'Bio',
            website: 'Website',
            location: 'Location',
            pronouns: 'Pronouns'
        },
        helper: {
            usernameLocked: 'Your username is anchored on-chain and cannot be changed.',
            usernameEditable: 'This username is editable off-chain.'
        },
        upload: {
            avatar: 'Profile picture',
            banner: 'Banner image',
            change: 'Change image',
            remove: 'Remove'
        }
    },
    actionsLabels: {
        reply: `Reply to ${terms.inkPrintSingular}`,
        reprint: terms.reprint,
        like: `Like ${terms.inkPrintSingular}`,
        share: 'Share'
    },
    toasts: {
        feedErrorTitle: 'Feed error',
        feedErrorMessage: `Unable to load ${terms.inkPrintPlural.toLowerCase()} right now.`,
        connectWalletTitle: 'Connect wallet',
        connectWalletPrintMessage: `Connect a wallet to ${terms.printVerb.toLowerCase()}.`,
        connectWalletLikeMessage: `Connect a wallet to like ${terms.inkPrintPlural.toLowerCase()}.`,
        connectWalletReprintMessage: `Connect a wallet to ${terms.reprint.toLowerCase()}.`,
        printFailedTitle: `${terms.inkPrintSingular} failed`,
        likeFailedTitle: 'Like failed',
        reprintFailedTitle: `${terms.reprint} failed`,
        walletConnectFailedTitle: 'Wallet connect failed',
        registrationFailedTitle: 'Registration failed'
    },
    errors: {
        noWallet: 'No Ink-compatible wallet found',
        connectWalletFirst: 'Connect wallet first'
    },
    a11y: {
        primaryNav: 'Primary navigation',
        logoAlt: (name) => `${name} logo`,
        userAvatarAlt: (name) => `${name} avatar`,
        composerAvatarAlt: 'Your profile photo'
    },
    meta: {
        now: 'now'
    }
};
