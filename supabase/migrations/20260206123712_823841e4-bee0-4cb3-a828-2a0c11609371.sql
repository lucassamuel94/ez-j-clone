-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'sdr');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add active column to profiles
ALTER TABLE public.profiles ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Update profiles policies to allow admins to manage all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Create invitations table
CREATE TABLE public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role app_role NOT NULL DEFAULT 'sdr',
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (email)
);

-- Enable RLS on invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitations
CREATE POLICY "Admins can view all invitations"
ON public.user_invitations
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert invitations"
ON public.user_invitations
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete invitations"
ON public.user_invitations
FOR DELETE
USING (public.is_admin(auth.uid()));