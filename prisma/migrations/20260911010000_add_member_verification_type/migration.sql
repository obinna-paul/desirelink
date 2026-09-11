-- Add a general "member" identity-verification type, available to every account
-- type (not just creators), for gates that aren't creator-specific - e.g. sending
-- a message now requires identity on file the same way posting premium content or
-- listing a service already does.
ALTER TYPE "VerificationRequestType" ADD VALUE 'member';
