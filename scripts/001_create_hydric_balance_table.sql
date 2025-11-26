-- Create table for hydric balance records
CREATE TABLE IF NOT EXISTS public.hydric_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id INTEGER NOT NULL,
  ingreso DECIMAL(10, 2) NOT NULL,
  egreso DECIMAL(10, 2) NOT NULL,
  balance DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries by patient_id
CREATE INDEX IF NOT EXISTS idx_hydric_balance_patient_id ON public.hydric_balance(patient_id);

-- Create index for faster queries by created_at
CREATE INDEX IF NOT EXISTS idx_hydric_balance_created_at ON public.hydric_balance(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.hydric_balance ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is a medical monitoring app without user auth)
CREATE POLICY "Allow all operations on hydric_balance" ON public.hydric_balance
  FOR ALL
  USING (true)
  WITH CHECK (true);
