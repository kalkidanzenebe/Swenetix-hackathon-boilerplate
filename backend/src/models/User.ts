import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// Stable palette so each member keeps a recognizable color across live sessions
const PALETTE = [
    "#2563eb", "#7c3aed", "#db2777", "#ea580c",
    "#059669", "#0891b2", "#c026d3", "#65a30d",
];

export const colorForName = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
        hash = (hash * 31 + name.charCodeAt(i)) % 100000;
    }
    return PALETTE[hash % PALETTE.length];
};

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    color: string; // Added for Hackathon Milestone 2 (Visual online indicator)
    isOnline: boolean; // Added for Hackathon Milestone 2 (Presence)
    googleId?: string;
    facebookId?: string;
    authProvider?: 'email' | 'google' | 'facebook';
    avatarUrl?: string;
    isEmailVerified: boolean;
    emailVerifiedAt?: Date;
    settings: {
        theme: string;
        fontSize: number;
        notificationsEnabled: boolean;
    };
    resetPasswordToken?: string | undefined;
    resetPasswordExpires?: Date | undefined;
    lastResetRequest?: Date;
    failedLoginAttempts: number;
    accountLockedUntil?: Date;

    comparePassword(candidatePassword: string): Promise<boolean>;
    isAccountLocked(): boolean;
    incrementFailedAttempts(): Promise<IUser>;
    resetFailedAttempts(): Promise<void>;
    lockAccount(): Promise<void>;
}

const userSchema = new Schema<IUser>({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: [function (this: any) { return this.authProvider === 'email'; }, 'Password is required for email authentication'],
        validate: {
            validator: function (this: any, password: string) {
                if (!password) return true;
                const errors: string[] = [];
                if (password.length < 8) errors.push('at least 8 characters');
                if (!/[a-z]/.test(password)) errors.push('at least 1 lowercase letter');
                if (!/[A-Z]/.test(password)) errors.push('at least 1 uppercase letter');
                if (!/\d/.test(password)) errors.push('at least 1 number');
                if (!/[@$!\%*?&]/.test(password)) errors.push('at least 1 special character (@$!%*?&)');

                if (errors.length > 0) {
                    this.passwordValidationErrors = errors;
                    return false;
                }
                return true;
            },
            message: function (this: any) {
                if (this && this.passwordValidationErrors && this.passwordValidationErrors.length > 0) {
                    return `Password must contain ${this.passwordValidationErrors.join(', ')}`;
                }
                return 'Password validation failed';
            }
        }
    },
    color: {
        type: String
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    googleId: { type: String, sparse: true },
    facebookId: { type: String, sparse: true },
    authProvider: {
        type: String,
        enum: ['email', 'google', 'facebook'],
        default: 'email'
    },
    avatarUrl: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    resetPasswordToken: { type: String, required: false },
    resetPasswordExpires: { type: Date, required: false },
    lastResetRequest: { type: Date, required: false },
    settings: {
        theme: { type: String, default: 'light', enum: ['light', 'dark'] },
        fontSize: { type: Number, default: 16, min: [12, 'Font size must be at least 12'], max: [24, 'Font size cannot exceed 24'] },
        notificationsEnabled: { type: Boolean, default: true }
    },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    accountLockedUntil: { type: Date, default: null }
}, {
    timestamps: true
});

// Pre-save hook to hash password AND generate avatar color
userSchema.pre('save', async function (next) {
    // Generate color if new or name changed
    if (this.isNew || this.isModified('name')) {
        this.color = colorForName(this.name);
    }

    if (!this.isModified('password') || !this.password) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isAccountLocked = function (): boolean {
    if (!this.accountLockedUntil) return false;
    return new Date() < this.accountLockedUntil;
};

userSchema.methods.incrementFailedAttempts = async function (): Promise<IUser> {
    this.failedLoginAttempts += 1;
    if (this.failedLoginAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setHours(lockUntil.getHours() + 2);
        this.accountLockedUntil = lockUntil;
    }
    return await this.save();
};

userSchema.methods.resetFailedAttempts = async function (): Promise<void> {
    this.failedLoginAttempts = 0;
    this.accountLockedUntil = null;
    await this.save();
};

userSchema.methods.lockAccount = async function (): Promise<void> {
    const lockUntil = new Date();
    lockUntil.setHours(lockUntil.getHours() + 2);
    this.accountLockedUntil = lockUntil;
    await this.save();
};

export const User = mongoose.model<IUser>('User', userSchema);