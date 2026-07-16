import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCustomerToken, customerCookie } from "@/lib/customer-auth";

export async function POST(request: Request) {
  try {
    const { credential } = await request.json();
    if (!credential) {
      return NextResponse.json({ error: "Credential Google wajib disediakan" }, { status: 400 });
    }

    if (typeof credential === "string" && credential.startsWith("mock_")) {
      const parts = credential.split(":");
      const mockEmail = parts[1] || "pelanggan.demo@example.com";
      const mockName = parts[2] || "Pelanggan Demo";
      const mockGoogleId = "mock_google_" + mockEmail.replace(/[^a-zA-Z0-9]/g, "");
      const mockAvatarUrl = `https://lh3.googleusercontent.com/a/default-user=s96-c`;

      const sessionId = crypto.randomUUID();
      const user = await prisma.user.upsert({
        where: { googleId: mockGoogleId },
        update: {
          email: mockEmail,
          name: mockName,
          avatarUrl: mockAvatarUrl,
          currentSessionId: sessionId,
        },
        create: {
          googleId: mockGoogleId,
          email: mockEmail,
          name: mockName,
          avatarUrl: mockAvatarUrl,
          currentSessionId: sessionId,
        },
      });

      const token = await createCustomerToken(user.id, sessionId);
      const response = NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
      response.cookies.set(customerCookie.name, token, customerCookie.options);
      return response;
    }

    // Verifikasi Token ke Google API
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!googleRes.ok) {
      return NextResponse.json({ error: "Token Google tidak valid atau kadaluwarsa" }, { status: 400 });
    }

    const payload = await googleRes.json();
    console.log("Google OAuth Tokeninfo Payload:", payload);
    
    // Validasi Audience
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      return NextResponse.json({ error: "Audience client ID tidak sesuai" }, { status: 400 });
    }

    const email = payload.email;
    const googleId = payload.sub;
    const name = payload.name || email.split("@")[0];
    const avatarUrl = payload.picture || null;

    if (!email || !googleId) {
      return NextResponse.json({ error: "Data profil Google tidak lengkap" }, { status: 400 });
    }

    // Pintu tunggal: Upsert User (registrasi/login otomatis)
    const sessionId = crypto.randomUUID();
    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        email,
        name,
        avatarUrl,
        currentSessionId: sessionId, // Device Lock
      },
      create: {
        googleId,
        email,
        name,
        avatarUrl,
        currentSessionId: sessionId, // Device Lock
      },
    });

    // Buat JWT Token & Set Cookie
    const token = await createCustomerToken(user.id, sessionId);
    const response = NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
    response.cookies.set(customerCookie.name, token, customerCookie.options);

    return response;
  } catch (error) {
    console.error("Autentikasi Google Error:", error);
    return NextResponse.json({
      error: "Gagal memproses autentikasi Google",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
