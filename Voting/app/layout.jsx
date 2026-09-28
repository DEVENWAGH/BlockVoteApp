import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import QueryProviderWrapper from "@/components/QueryProviderWrapper";

export const metadata = {
  title: "Block Vote — Blockchain Voting for Organizations",
  description:
    "Secure, transparent elections for colleges, companies, DAOs and communities. Powered by Ethereum.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BlockVote",
  },
};

export const viewport = {
  themeColor: "#041237",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.addEventListener('error', function(e) {
                  if (
                    (e.filename && (e.filename.indexOf('chrome-extension://') !== -1 || e.filename.indexOf('moz-extension://') !== -1)) ||
                    (e.message && (e.message.indexOf('M_ID') !== -1 || e.message.indexOf('bis_') !== -1))
                  ) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    return true;
                  }
                }, true);

                if (typeof MutationObserver !== 'undefined') {
                  var obs = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && (m.attributeName === 'bis_skin_checked' || m.attributeName === 'bis_register')) {
                        m.target.removeAttribute(m.attributeName);
                      }
                    }
                  });
                  obs.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['bis_skin_checked', 'bis_register'] });
                }
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <SessionProviderWrapper>
          <QueryProviderWrapper>
            <WalletProvider>
              <main>{children}</main>
            </WalletProvider>
          </QueryProviderWrapper>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
