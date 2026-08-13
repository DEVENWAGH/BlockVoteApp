import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import Admin from '@/lib/models/Admin';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    Credentials({
      name: 'Email & Password',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const admin = await Admin.findOne({
          email: credentials.email.toLowerCase().trim(),
        });

        if (!admin || !admin.passwordHash) return null;
        if (!admin.isEmailVerified) return null;

        const valid = await bcrypt.compare(String(credentials.password), admin.passwordHash);
        if (!valid) return null;

        return {
          id:    admin._id.toString(),
          email: admin.email,
          name:  admin.name,
          image: null,
        };
      },
    }),
  ],

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user?.email?.toLowerCase()?.trim();
        if (!email) {
          console.error('[auth] Google sign-in error: No email address returned from Google profile.');
          return false;
        }

        await connectDB();
        let admin = await Admin.findOne({ email });
        if (!admin) {
          admin = await Admin.create({
            name:            user.name || email.split('@')[0],
            email,
            googleId:        user.id || null,
            isEmailVerified: true,
          });
        } else {
          if (!admin.googleId && user.id) admin.googleId = user.id;
          admin.isEmailVerified = true;
          await admin.save();
        }
        user.id = admin._id.toString();
        user.name = admin.name;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.adminId = user.id;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.adminId = token.adminId;
      session.user.name = token.name;
      return session;
    },
  },

  session: { strategy: 'jwt' },
});
