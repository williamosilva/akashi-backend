import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

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

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return profile;
  }
}
