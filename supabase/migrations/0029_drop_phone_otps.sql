-- Phone verification moved to verify.mn MO-SMS (0028). The Mobicom OTP flow
-- was a research-phase mock and never shipped a UI, so its table goes with it.
drop table if exists phone_otps;
