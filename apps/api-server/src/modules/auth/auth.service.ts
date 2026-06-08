import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../db.js";

type AdminTokenPayload = {
  sub: string;
  email: string;
  role: "admin";
};

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const signAdminToken = (payload: AdminTokenPayload) =>
  jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });

export const bootstrapConfiguredAdmin = async () => {
  if (!env.adminEmail || !env.adminPassword) {
    return;
  }

  const email = normalizeEmail(env.adminEmail);
  const passwordHash = await bcrypt.hash(env.adminPassword, 12);

  await prisma.adminUser.upsert({
    create: {
      email,
      passwordHash,
    },
    update: {
      passwordHash,
    },
    where: {
      email,
    },
  });
};

export const loginAdmin = async (email: string, password: string) => {
  const admin = await prisma.adminUser.findUnique({
    where: {
      email: normalizeEmail(email),
    },
  });

  if (!admin) {
    throw new AuthServiceError("Invalid admin credentials", 401);
  }

  const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

  if (!isValidPassword) {
    throw new AuthServiceError("Invalid admin credentials", 401);
  }

  const token = signAdminToken({
    email: admin.email,
    role: "admin",
    sub: admin.id,
  });

  return {
    token,
    tokenType: "Bearer",
    expiresIn: env.jwtExpiresIn,
    admin: {
      id: admin.id,
      email: admin.email,
    },
  };
};

export const verifyAdminToken = (token: string) => {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as Partial<AdminTokenPayload>;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      payload.role !== "admin"
    ) {
      throw new AuthServiceError("Invalid authorization token", 401);
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError("Invalid authorization token", 401);
  }
};
