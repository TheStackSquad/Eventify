# audit/config/env.schema.psd1

# Every setting the audit suite knows. Data only, no code.
#   Need   modes in which the setting must be present      Warn   missing is a warning, not a failure
#   Secret never printed (a short fingerprint is shown)    Load   $false: known, but loaded by compose and the backend, not by this harness
#   Check  sk_test | pk_test | rigdb | url | email | duration
@{
    Vars = @(
        @{ Name = 'PAYSTACK_SECRET_KEY'; Need = @('tunnel'); Secret = $true; Check = 'sk_test'; Fix = 'Paystack dashboard, test mode, API keys. Only sk_test_ keys are allowed' }
        @{ Name = 'PAYSTACK_PUBLIC_KEY'; Secret = $true; Check = 'pk_test'; Fix = 'Paystack dashboard, test mode' }
        @{ Name = 'PAYSTACK_TEST_WEBHOOK_URL'; Check = 'url'; Fix = 'https://your-tunnel-domain/api/webhooks/paystack' }
        @{ Name = 'PAYSTACK_TEST_CALLBACK_URL'; Check = 'url'; Fix = 'http://localhost:3000/subscription/callback' }
        @{ Name = 'FRONTEND_URL'; Need = @('tunnel'); Check = 'url'; Fix = 'http://localhost:3000' }
        @{ Name = 'FRONTEND_BASE_URL'; Check = 'url'; Fix = 'same as FRONTEND_URL (defaults to it)' }
        @{ Name = 'BASE_URL'; Check = 'url'; Fix = 'http://localhost:8081' }
        @{ Name = 'AUDIT_DB_URL'; Need = @('tunnel'); Secret = $true; Check = 'rigdb'; Fix = 'must be the throwaway rig database: localhost, and a name containing loadtest, audit or test' }
        @{ Name = 'AUDIT_VENDOR_EMAIL'; Need = @('rig', 'tunnel'); Check = 'email'; Fix = 'the first test vendor account' }
        @{ Name = 'AUDIT_VENDOR_PASSWORD'; Need = @('rig', 'tunnel'); Secret = $true; Fix = 'its password' }
        @{ Name = 'AUDIT_VENDOR2_EMAIL'; Need = @('rig', 'tunnel'); Warn = $true; Check = 'email'; Fix = 'a second vendor; without it the ownership check (T8) is skipped' }
        @{ Name = 'AUDIT_VENDOR2_PASSWORD'; Need = @('rig', 'tunnel'); Warn = $true; Secret = $true; Fix = 'its password' }
        @{ Name = 'SUBSCRIPTION_WORKER_INTERVAL'; Check = 'duration'; Default = '20s'; Fix = 'for example 20s' }
        @{ Name = 'RSA_PRIVATE_KEY'; Load = $false }
        @{ Name = 'RSA_PUBLIC_KEY'; Load = $false }
        @{ Name = 'BACKEND_PORT'; Check = 'port'; Default = '8081'; Fix = 'the port the local backend listens on' }
        @{ Name = 'NGROK_DOMAIN'; Need = @('tunnel'); Check = 'domain'; Fix = 'your ngrok static domain, for example name.ngrok-free.dev' }
    )
}