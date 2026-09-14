using System;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
internal static class LiveThemeCheck {
    private static int Main(string[] args) {
        try {
            System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
            bool downloaded = false;
            string result = ThemeCatalog.LoadAsync("[]", args[0], message => { Console.WriteLine(message); if (message.StartsWith("Downloaded ")) downloaded = true; }).GetAwaiter().GetResult();
            object[] themes = (object[])new JavaScriptSerializer().DeserializeObject(result);
            if (!downloaded || themes.Length == 0) throw new Exception("No live themes downloaded.");
            Console.WriteLine("Live GitHub download verified: " + themes.Length + " themes.");
            return 0;
        } catch (Exception exception) { Console.Error.WriteLine(exception); return 1; }
    }
}
