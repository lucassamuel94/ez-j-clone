import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, LogOut, User, Mail, Bell, Loader2, Volume2, Clock, Camera, Code, Phone, Check, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GoogleCalendarSection } from '@/components/GoogleCalendarSection';
import { formatPhoneNumber } from '@/utils/phoneMask';
import { PageHeader } from '@/components/PageHeader';
import { sanitizeHtml } from '@/utils/sanitize';

const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading } = useCurrentUser();

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Notification preferences
  const [notifyOverduePush, setNotifyOverduePush] = useState(true);
  const [notifyOverdueEmail, setNotifyOverdueEmail] = useState(false);
  const [notifyOverdueSound, setNotifyOverdueSound] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Email signature
  const [emailSignature, setEmailSignature] = useState('');
  const [savedSignature, setSavedSignature] = useState('');
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  // WhatsApp corporativo
  const [corporateWhatsapp, setCorporateWhatsapp] = useState('');
  const [isEditingWhatsapp, setIsEditingWhatsapp] = useState(false);
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);

  // Load current profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('notify_overdue_push, notify_overdue_email, notify_overdue_sound, email_signature, whatsapp')
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        setNotifyOverduePush((data as any).notify_overdue_push ?? true);
        setNotifyOverdueEmail((data as any).notify_overdue_email ?? false);
        setNotifyOverdueSound((data as any).notify_overdue_sound ?? true);
        setEmailSignature((data as any).email_signature ?? '');
        setSavedSignature((data as any).email_signature ?? '');
        const rawWhatsapp = (data as any).whatsapp ?? '';
        if (rawWhatsapp) {
          const digits = rawWhatsapp.replace(/[^\d]/g, '');
          const withCountry = digits.startsWith('55') ? digits : '55' + digits;
          setCorporateWhatsapp(formatPhoneNumber(withCountry));
        }
      }
    };
    
    loadProfile();
  }, [user?.id]);

  const saveNotifPref = async (field: string, value: boolean) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value } as any)
        .eq('id', user.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error saving notification preference:', error);
      toast.error('Erro ao salvar preferência');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Remove old avatar if exists
      await supabase.storage.from('avatars').remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting param
      const avatarUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrlWithCacheBust } as any)
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Foto atualizada com sucesso!');
      // Invalidate user query to refresh avatar across the app
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao atualizar foto');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const initials = (user?.name || '')
    .split(' ')
    .map((n: string) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <PageHeader
              icon={<User className="h-5 w-5" strokeWidth={1.5} />}
              title="Meu Perfil"
              className="pb-0"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Profile info */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="items-center text-center pb-2">
                <div className="relative group">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 mb-4 flex items-center justify-center bg-foreground/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-6 w-6 animate-spin text-background" />
                    ) : (
                      <Camera className="h-6 w-6 text-background" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <CardTitle className="text-xl">{user?.name}</CardTitle>
                <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-primary/10 dark:bg-muted/50 rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="text-sm font-medium">{user?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-primary/10 dark:bg-muted/50 rounded-lg">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="text-sm font-medium">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-primary/10 dark:bg-muted/50 rounded-lg">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Telefone Corporativo (WhatsApp)</p>
                    {isEditingWhatsapp ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={corporateWhatsapp}
                          onChange={(e) => setCorporateWhatsapp(formatPhoneNumber(e.target.value))}
                          placeholder="+55 (11) 99999-9999"
                          className="h-7 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          disabled={isSavingWhatsapp}
                          onClick={async () => {
                            if (!user?.id) return;
                            setIsSavingWhatsapp(true);
                            try {
                              const { error } = await supabase
                                .from('profiles')
                                .update({ whatsapp: corporateWhatsapp || null } as any)
                                .eq('id', user.id);
                              if (error) throw error;
                              toast.success('WhatsApp salvo!');
                              setIsEditingWhatsapp(false);
                            } catch (err) {
                              toast.error('Erro ao salvar');
                            } finally {
                              setIsSavingWhatsapp(false);
                            }
                          }}
                        >
                          {isSavingWhatsapp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{corporateWhatsapp || 'Não informado'}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => setIsEditingWhatsapp(true)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-primary/10 dark:bg-muted/50 rounded-lg">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fuso Horário do Sistema</p>
                    <p className="text-sm font-medium">America/São Paulo (GMT-3)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google Calendar Integration */}
            <GoogleCalendarSection />

          </div>

          {/* Right column - Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notification Preferences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Preferências de Notificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Clientes com agendamento vencido</p>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Receba alertas quando um lead ultrapassar a data/hora de retorno agendado
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between p-3 bg-primary/10 dark:bg-muted/50 rounded-lg">
                      <Label htmlFor="notify-push" className="text-sm cursor-pointer flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        Push
                      </Label>
                      <Switch
                        id="notify-push"
                        checked={notifyOverduePush}
                        onCheckedChange={(checked) => {
                          setNotifyOverduePush(checked);
                          saveNotifPref('notify_overdue_push', checked);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-primary/10 dark:bg-muted/50 rounded-lg">
                      <Label htmlFor="notify-email" className="text-sm cursor-pointer flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        E-mail
                      </Label>
                      <Switch
                        id="notify-email"
                        checked={notifyOverdueEmail}
                        onCheckedChange={(checked) => {
                          setNotifyOverdueEmail(checked);
                          saveNotifPref('notify_overdue_email', checked);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-primary/10 dark:bg-muted/50 rounded-lg">
                      <Label htmlFor="notify-sound" className="text-sm cursor-pointer flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        Som
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            try {
                              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                              const osc = ctx.createOscillator();
                              const gain = ctx.createGain();
                              osc.connect(gain);
                              gain.connect(ctx.destination);
                              osc.type = 'sine';
                              osc.frequency.setValueAtTime(880, ctx.currentTime);
                              osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.15);
                              gain.gain.setValueAtTime(0.3, ctx.currentTime);
                              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                              osc.start(ctx.currentTime);
                              osc.stop(ctx.currentTime + 0.4);
                            } catch (e) {
                              console.warn('Could not play sound:', e);
                            }
                          }}
                        >
                          🔊
                        </Button>
                        <Switch
                          id="notify-sound"
                          checked={notifyOverdueSound}
                          onCheckedChange={(checked) => {
                            setNotifyOverdueSound(checked);
                            saveNotifPref('notify_overdue_sound', checked);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Email Signature */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  Assinatura de E-mail
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">HTML da Assinatura</Label>
                    <Textarea
                      value={emailSignature}
                      onChange={(e) => setEmailSignature(e.target.value)}
                      placeholder="Cole aqui o HTML da sua assinatura de e-mail..."
                      className="font-mono text-xs min-h-[150px] mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Preview</Label>
                    <div
                      className="mt-1 p-3 border border-border rounded-lg bg-background text-sm overflow-auto [&_img[style*='border-radius']]:!aspect-square [&_img[style*='border-radius']]:object-cover"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(emailSignature || '<span class="text-muted-foreground">Nenhuma assinatura configurada</span>') }}
                    />
                  </div>
                </div>

                <Button
                  onClick={async () => {
                    if (!user?.id) return;
                    setIsSavingSignature(true);
                    try {
                      const { error } = await supabase
                        .from('profiles')
                        .update({ email_signature: emailSignature } as any)
                        .eq('id', user.id);
                       if (error) throw error;
                      setSavedSignature(emailSignature);
                      toast.success('Assinatura salva com sucesso!');
                    } catch (error) {
                      console.error('Error saving signature:', error);
                      toast.error('Erro ao salvar assinatura');
                    } finally {
                      setIsSavingSignature(false);
                    }
                  }}
                  disabled={isSavingSignature || emailSignature === savedSignature}
                  className="w-full"
                  size="sm"
                >
                  {isSavingSignature ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Salvar Assinatura
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <Button 
            variant="ghost"
            className="text-destructive hover:bg-transparent hover:text-destructive font-normal hover:font-bold" 
            onClick={handleLogout}
          >
            Fazer logout da conta
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
