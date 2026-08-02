# Ponto App Pessoal

Aplicativo pessoal para registrar marcações de ponto, calcular horas extras,
adicional noturno, folgas e estimativas de holerite.

## Backup no Google Drive

O APK usa o seletor de armazenamento do Android para acessar somente a pasta
escolhida pelo usuário. Na primeira configuração, selecione a pasta
`Ponto App Pessoal` dentro do Google Drive.

- `backup-atual.json`: estado mais recente do aplicativo.
- `backup-anterior.json`: cópia anterior para recuperação.
- O app continua salvando localmente quando o Drive estiver indisponível.
- Alterações pendentes são sincronizadas quando o app volta ao primeiro plano.
- Nenhuma senha ou chave do Google fica armazenada no código.

## Desenvolvimento

```bash
npm ci
npm test
npm run android:sync
cd android
./gradlew assembleDebug
```

O APK de depuração é gerado em
`android/app/build/outputs/apk/debug/app-debug.apk`.
