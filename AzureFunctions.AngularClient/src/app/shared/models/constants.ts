
export namespace Constants {
    export namespace HttpMethods {
        export const GET = 'get';
        export const POST = 'post';
        export const DELETE = 'delete';
        export const HEAD = 'head';
        export const PATCH = 'patch';
        export const PUT = 'put';
        export const OPTIONS = 'options';
        export const TRACE = 'trace';
    }
    export const serviceHost =
        window.location.hostname === 'localhost' || window.appsvc.env.runtimeType === 'Standalone'
            ? `https://${window.location.hostname}:${window.location.port}/`
            : `https://${window.location.hostname}/`;

    export const nodeVersion = '6.5.0';
    export const latest = 'latest';
    export const disabled = 'disabled';
    export const runtimeVersionAppSettingName = 'FUNCTIONS_EXTENSION_VERSION';
    export const nodeVersionAppSettingName = 'WEBSITE_NODE_DEFAULT_VERSION';
    export const azureJobsExtensionVersion = 'AZUREJOBS_EXTENSION_VERSION';
    export const routingExtensionVersionAppSettingName = 'ROUTING_EXTENSION_VERSION';
    export const functionAppEditModeSettingName = 'FUNCTION_APP_EDIT_MODE';
    export const instrumentationKeySettingName = 'APPINSIGHTS_INSTRUMENTATIONKEY';
    export const slotsSecretStorageSettingsName = 'AzureWebJobsSecretStorageType';
    export const slotsSecretStorageSettingsValue = 'Blob';
    export const contentShareConfigSettingsName = 'WEBSITE_CONTENTSHARE';
    export const azureWebJobsDashboardSettingsName = 'AzureWebJobsDashboard';

    export const swaggerSecretName = 'swaggerdocumentationkey';
    export const eventGridName = 'eventgridextensionconfig_extension';

    export const portalHostName = 'https://portal.azure.com';
    export const webAppsHostName = 'https://web1.appsvcux.ext.azure.com';
    export const msPortalHostName = 'https://ms.portal.azure.com';
    export const ReadWriteMode = 'readWrite'.toLocaleLowerCase();
    export const ReadOnlyMode = 'readOnly'.toLocaleLowerCase();

    export const OIDKey = 'http://schemas.microsoft.com/identity/claims/objectidentifier';
    export const BYOBTokenMapSettingName = 'BYOB_TokenMap';
    export const defaultBYOBLocation = '/data/byob_graphmap';
    export const MSGraphResource = 'https://graph.microsoft.com';
    export const latestMSGraphVersion = '1.0';
    export const WebhookHandlerFunctionName = 'RefreshO365Subscriptions';
    export const WebhookHandlerFunctionId = 'TimerTrigger-CSharpWebhookHandler';
    export const WebhookFunctionName = 'MSGraphWebhook';

    export namespace TabCommunicationVerbs {
        export const getStartInfo = 'get-startup-info';
        export const sentStartInfo = 'startup-info';
        export const updatedFile = 'updated-file-notice'
        export const newToken = 'new-token';
        export const parentClosed = 'parent-window-closed';
    }

    export namespace SiteTabIds {
        export const overview = 'overview';
        export const monitor = 'monitor';
        export const features = 'platformFeatures';
        export const functionRuntime = 'functionRuntimeSettings';
        export const apiDefinition = 'apiDefinition';
        export const config = 'config';
        export const applicationSettings = 'appSettings';
        export const logicApps = 'logicApps';
    }

    export namespace Arm {
        export const MaxSubscriptionBatchSize = 40;
    }

    export namespace AvailabilityStates {
        export const unknown = 'unknown';
        export const unavailable = 'unavailable';
        export const available = 'available';

        // Not entirely sure what this means, but it seems to be synonymous with unavailable
        export const userinitiated = 'userinitiated';
    }

    export namespace NotificationIds {
        export const alwaysOn = 'alwaysOn';
        export const newRuntimeVersion = 'newRuntimeVersion';
        export const slotsHostId = 'slotsBlobStorage';
        export const runtimeV2 = 'runtimeV2';
    }

    export namespace Validations {
        export const websiteNameMinLength: number = 2;
        export const websiteNameMaxLength: number = 60;
    }

    export namespace Regex {
        export const invalidEntityName: RegExp = /[^\u00BF-\u1FFF\u2C00-\uD7FF\a-zA-Z0-9-]/;// matches any character(i.e. german, chinese, english) or -
        export const header: RegExp = /^[a-zA-Z0-9\-_]+$/;
        export const functionName: RegExp = /^[a-zA-Z][a-zA-Z0-9_\-]{0,127}$/;
    }

    export namespace Links {
        export const standaloneCreateLearnMore = 'https://go.microsoft.com/fwlink/?linkid=848756';
        export const pythonLearnMore = 'https://go.microsoft.com/fwlink/?linkid=852196';
        export const clientAffinityLearnMore = 'https://go.microsoft.com/fwlink/?linkid=798249';
    }

    export namespace LocalStorageKeys {
        export const siteTabs = '/site/tabs';
        export const savedSubsKey = '/subscriptions/selectedIds';
    }

    export namespace Order {
        export const templateOrder: string[] =
            [
                'HttpTrigger-',
                'TimerTrigger-',
                'QueueTrigger-',
                'ServiceBusQueueTrigger-',
                'ServiceBusTopicTrigger-',
                'BlobTrigger-',
                'EventHubTrigger-',
                'CosmosDBTrigger-',
                'IoTHubTrigger-',
                'IoTHubServiceBusQueueTrigger-',
                'IoTHubServiceBusTopicTrigger-',
                'GenericWebHook-',
                'GitHubCommenter-',
                'GitHubWebHook-',
                'HttpGET(CRUD)-',
                'HttpPOST(CRUD)-',
                'HttpPUT(CRUD)-',
                'HttpTriggerWithParameters-',
                'ScheduledMail-',
                'SendGrid-',
                'FaceLocator-',
                'ImageResizer-',
                'SasToken-',
                'ManualTrigger-',
                'CDS-',
                'AppInsightsHttpAvailability-',
                'AppInsightsRealtimePowerBI-',
                'AppInsightsScheduledAnalytics-',
                'AppInsightsScheduledDigest-',
                'ExternalFileTrigger-',
                'ExternalTable-'
            ];
    }

    // NOTE: If you change any string values here, make sure you search for references to the values
    // in any HTML templates first!
    export namespace ScenarioIds {
        export const addSiteConfigTab = 'AddSiteConfigTab';
        export const addSiteFeaturesTab = 'AddSiteFeaturesTab';
        export const getSiteSlotLimits = 'GetSiteSlotLimits';
        export const showSiteAvailability = 'ShowSiteAvailability';
        export const addResourceExplorer = 'AddResourceExplorer';
        export const addPushNotifications = 'AddPushNotifications';
        export const addMsi = 'AddMsi';
        export const addTinfoil = 'AddTinfoil';
        export const addSiteQuotas = 'ShowSiteQuotas';
        export const addConsole = 'AddConsole';
        export const addSsh = 'AddSsh';
        export const enablePushNotifications = 'EnablePushNotifications';
        export const enableAuth = 'EnableAuth';
        export const enableMsi = 'EnableMsi';
        export const enableNetworking = 'EnableNetworking';
        export const enableAppServiceEditor = 'EnableAppServiceEditor';
        export const enableExtensions = 'EnableExtensions';
        export const enableLogStream = 'EnableLogStream';
        export const enableProcessExplorer = 'EnableProcessExplorer';
        export const enableBackups = 'EnableBackups';
        export const enableTinfoil = 'EnableTinfoil';
        export const addSiteFileStorage = 'ShowSiteFileStorage';
        export const showSitePin = 'ShowSitePin';
        export const showCreateRefreshSub = 'ShowCreateRefreshSub';
        export const enablePlatform64 = 'EnablePlatform64';
        export const enableAlwaysOn = 'EnableAlwaysOn';
        export const deleteAppDirectly = 'deleteAppDirectly';
        export const enableAutoSwap = 'EnableAutoSwap';

        export const createApp = 'createApp';
        export const filterAppNodeChildren = 'FilterAppNodeChildren';
        export const headerOnTopOfSideNav = 'headerOnTopOfSideNav';
        export const topBarWarning = 'TopBarWarning';
        export const userMenu = 'UserMenu';
        export const standAloneUserMenu = 'StandAloneUserMenu';
    }

    export namespace ServerFarmSku {
        export const free = 'Free';
        export const shared = 'Shared';
        export const basic = 'Basic';
        export const standard = 'Standard';
        export const premium = 'Premium';
        export const premiumV2 = 'PremiumV2';
        export const isolated = 'Isolated';
        export const dynamic = 'Dynamic';
    }

    export namespace NationalCloudArmUris {
        export const fairfax = 'https://management.usgovcloudapi.net';
        export const blackforest = 'https://management.microsoftazure.de';
        export const mooncake = 'https://management.chinacloudapi.cn';
    }

    export namespace LogCategories {
        export const FunctionEdit = 'FunctionEdit';
        export const FunctionMonitor = 'FunctionMonitor';
        export const SideNav = 'SideNav';
        export const siteDashboard = 'SiteDashboard';
        export const scenarioService = 'ScenarioService';
        export const apiDetails = 'ApiDetails';
        export const broadcastService = 'BroadcastService';
        export const newSlot = 'NewSlot';
        export const svgLoader = 'SvgLoader';
        export const busyState = 'BusyState';
        export const siteConfig = 'SiteConfig';
        export const generalSettings = 'GeneralSettings';
        export const appSettings = 'AppSettings';
        export const connectionStrings = 'ConnectionStrings';
        export const defaultDocuments = 'DefaultDocuments';
        export const handlerMappings = 'HandlerMappings';
        export const virtualDirectories = 'VirtualDirectories';
        export const logicapps = 'LogicApps';
        export const subsCriptions = 'SubsCriptions';
        export const functionAppSettings = 'FunctionAppSettings';
        export const swaggerDefinition = 'SwaggerDefinition';
        export const binding = 'Binding';
        export const functionNew = 'FunctionNew';
    }

    export namespace KeyCodes {
        export const tab = 9;
        export const enter = 13;
        export const shiftLeft = 16;
        export const space = 32;
        export const escape = 27;
        export const end = 35;
        export const home = 36;
        export const arrowLeft = 37;
        export const arrowUp = 38;
        export const arrowRight = 39;
        export const arrowDown = 40;
        export const _delete = 46;
        export const f2 = 113;
    }

    export namespace ExtensionInstallStatus {
        export const Started = 'Started';
        export const Succeeded = 'Succeeded';
        export const Failed = 'Failed';
    }

    export namespace DomEvents {
        export const keydown = 'keydown';
        export const click = 'click';
    }

    export namespace RuntimeImage {
        export const v1 = 'v1';
        export const v2 = 'v2';
        export const custom = 'custom';
    }

    export namespace HttpConstants {
        export const statusCodeMap = {
            0: 'Unknown HTTP Error',
            100: 'Continue',
            101: 'Switching Protocols',
            102: 'Processing',
            200: 'OK',
            201: 'Created',
            202: 'Accepted',
            203: 'Non-Authoritative Information',
            204: 'No Content',
            205: 'Reset Content',
            206: 'Partial Content',
            300: 'Multiple Choices',
            301: 'Moved Permanently',
            302: 'Found',
            303: 'See Other',
            304: 'Not Modified',
            305: 'Use Proxy',
            306: '(Unused)',
            307: 'Temporary Redirect',
            400: 'Bad Request',
            401: 'Unauthorized',
            402: 'Payment Required',
            403: 'Forbidden',
            404: 'Not Found',
            405: 'Method Not Allowed',
            406: 'Not Acceptable',
            407: 'Proxy Authentication Required',
            408: 'Request Timeout',
            409: 'Conflict',
            410: 'Gone',
            411: 'Length Required',
            412: 'Precondition Failed',
            413: 'Request Entity Too Large',
            414: 'Request-URI Too Long',
            415: 'Unsupported Media Type',
            416: 'Requested Range Not Satisfiable',
            417: 'Expectation Failed',
            500: 'Internal Server Error',
            501: 'Not Implemented',
            502: 'Bad Gateway',
            503: 'Service Unavailable',
            504: 'Gateway Timeout',
            505: 'HTTP Version Not Supported'
        };

        export const genericStatusCodeMap = {
            100: 'Informational',
            200: 'Success',
            300: 'Redirection',
            400: 'Client Error',
            500: 'Server Error'
        };
    }
}
