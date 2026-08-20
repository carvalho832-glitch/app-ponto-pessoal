package br.com.juliocarvalho.pontoapp;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "DriveBackup")
public class DriveBackupPlugin extends Plugin {
    private static final String PREFERENCES = "ponto_drive_backup";
    private static final String FOLDER_URI_KEY = "folder_uri";
    private static final String EXPECTED_FOLDER = "Ponto App Pessoal";
    private static final String CURRENT_BACKUP = "backup-atual.json";
    private static final String PREVIOUS_BACKUP = "backup-anterior.json";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void selectFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "folderSelected");
    }

    @ActivityCallback
    private void folderSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Seleção da pasta cancelada.", "FOLDER_SELECTION_CANCELLED");
            return;
        }

        Uri folderUri = data.getData();
        ContentResolver resolver = getContext().getContentResolver();
        String folderName = queryDisplayName(resolver, folderDocumentUri(folderUri));

        if (!EXPECTED_FOLDER.equals(folderName)) {
            call.reject("Escolha exatamente a pasta “" + EXPECTED_FOLDER + "” no Google Drive.", "WRONG_FOLDER");
            return;
        }

        int takeFlags = data.getFlags() & (
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        );

        try {
            resolver.takePersistableUriPermission(folderUri, takeFlags);
            preferences().edit().putString(FOLDER_URI_KEY, folderUri.toString()).apply();

            JSObject response = new JSObject();
            response.put("connected", true);
            response.put("folderName", folderName);
            call.resolve(response);
        } catch (SecurityException error) {
            call.reject("O Android não conseguiu manter acesso à pasta escolhida.", "PERSIST_PERMISSION_FAILED", error);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        executor.execute(() -> {
            Uri folderUri = savedFolderUri();
            JSObject response = new JSObject();

            if (folderUri == null || !hasPersistedPermission(folderUri)) {
                response.put("connected", false);
                resolveOnMainThread(call, response);
                return;
            }

            try {
                String folderName = queryDisplayName(
                    getContext().getContentResolver(),
                    folderDocumentUri(folderUri)
                );
                boolean connected = EXPECTED_FOLDER.equals(folderName);
                response.put("connected", connected);
                response.put("folderName", folderName == null ? "" : folderName);
                resolveOnMainThread(call, response);
            } catch (Exception error) {
                response.put("connected", false);
                resolveOnMainThread(call, response);
            }
        });
    }

    @PluginMethod
    public void readBackup(PluginCall call) {
        executor.execute(() -> {
            try {
                Uri folderUri = requireFolderUri();
                ContentResolver resolver = getContext().getContentResolver();
                Uri fileUri = findChild(resolver, folderUri, CURRENT_BACKUP);
                JSObject response = new JSObject();

                if (fileUri == null) {
                    response.put("exists", false);
                    resolveOnMainThread(call, response);
                    return;
                }

                response.put("exists", true);
                response.put("content", readText(resolver, fileUri));
                resolveOnMainThread(call, response);
            } catch (Exception error) {
                rejectOnMainThread(call, "Não foi possível ler o backup do Google Drive.", "BACKUP_READ_FAILED", error);
            }
        });
    }

    @PluginMethod
    public void writeBackup(PluginCall call) {
        String content = call.getString("content");
        if (content == null || content.trim().isEmpty()) {
            call.reject("O conteúdo do backup está vazio.", "EMPTY_BACKUP");
            return;
        }

        executor.execute(() -> {
            try {
                Uri folderUri = requireFolderUri();
                ContentResolver resolver = getContext().getContentResolver();
                Uri currentUri = findChild(resolver, folderUri, CURRENT_BACKUP);

                if (currentUri != null) {
                    String previousContent = readText(resolver, currentUri);
                    if (!previousContent.trim().isEmpty()) {
                        Uri previousUri = findOrCreateChild(resolver, folderUri, PREVIOUS_BACKUP);
                        writeText(resolver, previousUri, previousContent);
                    }
                } else {
                    currentUri = findOrCreateChild(resolver, folderUri, CURRENT_BACKUP);
                }

                writeText(resolver, currentUri, content);

                JSObject response = new JSObject();
                response.put("saved", true);
                response.put("fileName", CURRENT_BACKUP);
                response.put("savedAt", System.currentTimeMillis());
                resolveOnMainThread(call, response);
            } catch (Exception error) {
                rejectOnMainThread(call, "Não foi possível salvar o backup no Google Drive.", "BACKUP_WRITE_FAILED", error);
            }
        });
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private Uri savedFolderUri() {
        String value = preferences().getString(FOLDER_URI_KEY, null);
        return value == null || value.isEmpty() ? null : Uri.parse(value);
    }

    private Uri requireFolderUri() {
        Uri folderUri = savedFolderUri();
        if (folderUri == null || !hasPersistedPermission(folderUri)) {
            throw new IllegalStateException("A pasta do Google Drive ainda não foi escolhida.");
        }
        return folderUri;
    }

    private boolean hasPersistedPermission(Uri folderUri) {
        return getContext().getContentResolver().getPersistedUriPermissions().stream().anyMatch(permission ->
            permission.getUri().equals(folderUri) &&
            permission.isReadPermission() &&
            permission.isWritePermission()
        );
    }

    private Uri folderDocumentUri(Uri treeUri) {
        String documentId = DocumentsContract.getTreeDocumentId(treeUri);
        return DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId);
    }

    private Uri findChild(ContentResolver resolver, Uri treeUri, String fileName) {
        String parentId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId);
        String[] projection = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME
        };

        try (Cursor cursor = resolver.query(childrenUri, projection, null, null, null)) {
            if (cursor == null) return null;
            int idIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME);

            while (cursor.moveToNext()) {
                if (fileName.equals(cursor.getString(nameIndex))) {
                    return DocumentsContract.buildDocumentUriUsingTree(treeUri, cursor.getString(idIndex));
                }
            }
        }

        return null;
    }

    private Uri findOrCreateChild(ContentResolver resolver, Uri treeUri, String fileName) throws IOException {
        Uri existing = findChild(resolver, treeUri, fileName);
        if (existing != null) return existing;

        Uri created = DocumentsContract.createDocument(
            resolver,
            folderDocumentUri(treeUri),
            "application/json",
            fileName
        );
        if (created == null) throw new IOException("O provedor não criou o arquivo " + fileName + ".");
        return created;
    }

    private String readText(ContentResolver resolver, Uri uri) throws IOException {
        StringBuilder content = new StringBuilder();
        try (InputStream stream = resolver.openInputStream(uri)) {
            if (stream == null) throw new IOException("O arquivo não pôde ser aberto para leitura.");
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    content.append(line).append('\n');
                }
            }
        }
        return content.toString();
    }

    private void writeText(ContentResolver resolver, Uri uri, String content) throws IOException {
        OutputStream stream = resolver.openOutputStream(uri, "wt");
        if (stream == null) throw new IOException("O arquivo não pôde ser aberto para gravação.");
        try (OutputStream output = stream) {
            output.write(content.getBytes(StandardCharsets.UTF_8));
            output.flush();
        }
    }

    private String queryDisplayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) return cursor.getString(nameIndex);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void resolveOnMainThread(PluginCall call, JSObject response) {
        getActivity().runOnUiThread(() -> call.resolve(response));
    }

    private void rejectOnMainThread(PluginCall call, String message, String code, Exception error) {
        getActivity().runOnUiThread(() -> call.reject(message, code, error));
    }
}
