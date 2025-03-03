import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GitHubProfile {
  id: string;
  displayName?: string;
  username?: string;
  emails?: Array<{ value: string; verified?: boolean; primary?: boolean }>;
  photos?: Array<{ value: string }>;
  provider: string;
  _json?: {
    name?: string;
    avatar_url?: string;
  };
}

interface GoogleProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string; verified: boolean }>;
  photos?: Array<{ value: string }>;
  provider: string;
}

@Injectable()
export class GoogleAuthStrategy extends PassportStrategy(
  GoogleStrategy,
  'google',
) {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
  ) {
    const { id, displayName, emails, photos, provider } = profile;

    return {
      id,
      email: emails[0].value,
      displayName,
      photo: photos?.[0]?.value,
      provider,
    };
  }
}

@Injectable()
export class GitHubAuthStrategy extends PassportStrategy(
  GitHubStrategy,
  'github',
) {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get('GITHUB_CLIENT_ID'),
      clientSecret: configService.get('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GitHubProfile,
  ) {
    let emails = profile.emails || [];

    if (!emails.length || !emails.some((e) => e.verified)) {
      try {
        const emailResponse = await fetch(
          'https://api.github.com/user/emails',
          { headers: { Authorization: `token ${accessToken}` } },
        );
        const emailData: Array<{
          email: string;
          verified: boolean;
          primary: boolean;
        }> = await emailResponse.json();

        emails = emailData
          .filter((email) => email.verified)
          .sort((a, b) => (a.primary === b.primary ? 0 : a.primary ? -1 : 1))
          .map((email) => ({
            value: email.email,
            verified: email.verified,
            primary: email.primary,
          }));
      } catch (error) {
        console.error('Failed to fetch GitHub emails:', error);
      }
    }

    const primaryEmail =
      emails.find((e) => e.primary)?.value ||
      emails[0]?.value ||
      `${profile.id}@github.social`;

    return {
      id: profile.id,
      email: primaryEmail,
      displayName:
        profile.displayName ||
        profile._json?.name ||
        profile.username ||
        'Usuário GitHub',
      photo: profile.photos?.[0]?.value || profile._json?.avatar_url || '',
      provider: 'github',
    };
  }
}
