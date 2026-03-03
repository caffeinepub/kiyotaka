import List "mo:core/List";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Order "mo:core/Order";
import Bool "mo:core/Bool";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Types
  type Watchlist = [Text];

  type Holding = {
    symbol : Text;
    name : Text;
    amount : Float;
    buyPrice : Float;
  };

  type Alert = {
    symbol : Text;
    targetPrice : Float;
    direction : Text; // "above" or "below"
    active : Bool;
  };

  type Signal = {
    id : Nat;
    title : Text;
    body : Text;
    symbol : Text;
    signalType : Text; // "buy", "sell", "hold", "neutral"
    timestamp : Int;
  };

  type Coin = {
    symbol : Text;
    name : Text;
    price : Float;
    change24h : Float;
    change7d : Float;
    volume24h : Float;
    marketCap : Float;
    circulatingSupply : Float;
    rank : Nat;
  };

  public type Candle = {
    time : Int;
    open : Float;
    high : Float;
    low : Float;
    close : Float;
    volume : Float;
  };

  public type UserProfile = {
    name : Text;
  };

  // MixinAuthorization component integration
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // State variables
  let watchlists = Map.empty<Principal, Watchlist>();
  let holdings = Map.empty<Principal, List.List<Holding>>();
  let alerts = Map.empty<Principal, List.List<Alert>>();
  var nextSignalId = 1;
  let signals = Map.empty<Nat, Signal>();
  let coins = Map.empty<Text, Coin>();
  let candles = Map.empty<Text, [Candle]>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Seed mock coin and candle data
  system func preupgrade() {
    let initialCoins = [
      {
        symbol = "BTC";
        name = "Bitcoin";
        price = 50846.40;
        change24h = 2.18;
        change7d = 3.05;
        volume24h = 2483652.86;
        marketCap = 5198867.22;
        circulatingSupply = 19470898.0;
        rank = 1;
      },
      {
        symbol = "ETH";
        name = "Ethereum";
        price = 4326.55;
        change24h = 2.13;
        change7d = 4.73;
        volume24h = 1817655.94;
        marketCap = 5006872.34;
        circulatingSupply = 119080563.0;
        rank = 2;
      },
      {
        symbol = "BNB";
        name = "Binance Coin";
        price = 582.34;
        change24h = 2.51;
        change7d = 3.85;
        volume24h = 1623789.12;
        marketCap = 5306878.41;
        circulatingSupply = 168137036.0;
        rank = 3;
      },
      {
        symbol = "SOL";
        name = "Solana";
        price = 1368.79;
        change24h = 2.31;
        change7d = 4.21;
        volume24h = 1456234.62;
        marketCap = 5627348.97;
        circulatingSupply = 301307632.0;
        rank = 4;
      },
      {
        symbol = "XRP";
        name = "Ripple";
        price = 214.77;
        change24h = 3.82;
        change7d = 5.18;
        volume24h = 1234789.14;
        marketCap = 5102764.30;
        circulatingSupply = 55919220000.0;
        rank = 5;
      },
      {
        symbol = "ADA";
        name = "Cardano";
        price = 304.51;
        change24h = 5.19;
        change7d = 3.82;
        volume24h = 956789.07;
        marketCap = 5312674.05;
        circulatingSupply = 31839934000.0;
        rank = 6;
      },
      {
        symbol = "DOGE";
        name = "Dogecoin";
        price = 527.31;
        change24h = 1.04;
        change7d = 2.61;
        volume24h = 798475.18;
        marketCap = 3217845.30;
        circulatingSupply = 141180246382.0;
        rank = 7;
      },
      {
        symbol = "AVAX";
        name = "Avalanche";
        price = 104.84;
        change24h = 4.85;
        change7d = 5.03;
        volume24h = 645617.32;
        marketCap = 3078198.15;
        circulatingSupply = 382988324.0;
        rank = 8;
      },
      {
        symbol = "MATIC";
        name = "Polygon";
        price = 163.06;
        change24h = 2.42;
        change7d = 3.57;
        volume24h = 436809.09;
        marketCap = 1345059.06;
        circulatingSupply = 9870060597.0;
        rank = 9;
      },
      {
        symbol = "DOT";
        name = "Polkadot";
        price = 423.80;
        change24h = 7.21;
        change7d = 3.88;
        volume24h = 259640.83;
        marketCap = 2614221.85;
        circulatingSupply = 1230145683.0;
        rank = 10;
      },
    ];

    for (coin in initialCoins.values()) {
      coins.add(coin.symbol, coin);
    };

    candles.add("BTC", generateCandles(50000.0, 1.0, 200));
    candles.add("ETH", generateCandles(4000.0, 0.5, 200));
    candles.add("SOL", generateCandles(200.0, 2.0, 200));
    candles.add("BNB", generateCandles(400.0, 1.5, 200));
    candles.add("XRP", generateCandles(1.5, 1.25, 200));
    candles.add("ADA", generateCandles(1.2, 1.20, 200));
    candles.add("DOGE", generateCandles(0.16, 2.8, 200));
    candles.add("AVAX", generateCandles(90.0, 1.5, 200));
    candles.add("MATIC", generateCandles(1.4, 2.0, 200));
    candles.add("DOT", generateCandles(10.2, 1.7, 200));
  };

  // Candlestick data generation (still mock data but more realistic)
  func generateCandles(startPrice : Float, volatility : Float, count : Nat) : [Candle] {
    let mutCandles = List.empty<Candle>();
    var currentPrice = startPrice;
    var currentTime = Time.now();
    var highPrice = startPrice * 1.005;
    var lowPrice = startPrice * 0.995;

    for (i in Nat.range(0, count)) {
      let change : Float = (i % 8).toFloat() * (3 * volatility);
      currentPrice += volatility * change + 0.1 ** Float.abs(change);

      let changePercent = Float.abs(change) * 0.01;
      highPrice := if (change % 2 == 0) {
        currentPrice + (changePercent * currentPrice);
      } else {
        currentPrice - (changePercent * currentPrice);
      };
      lowPrice := if (change % 2 == 0) {
        currentPrice - (changePercent * currentPrice) * 0.8;
      } else {
        currentPrice + (changePercent * currentPrice) * 0.8;
      };

      mutCandles.add({
        time = currentTime;
        open = currentPrice;
        high = highPrice;
        low = lowPrice;
        close = if (change % 2 == 0) {
          currentPrice * 1.002;
        } else {
          currentPrice * 0.998;
        };
        volume = 2000.0 + (change * 900.0);
      });

      currentTime -= 60 * 60 * 1000000000; // 1 hour
    };

    mutCandles.reverse().toArray();
  };

  // User Profile functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Watchlist functions
  public shared ({ caller }) func addToWatchlist(symbol : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage watchlists");
    };

    let current = switch (watchlists.get(caller)) {
      case (null) { [] };
      case (?list) { list };
    };

    switch (current.find(func(s) { s == symbol })) {
      case (null) {};
      case (_) { Runtime.trap("Symbol already in watchlist") };
    };

    let newList = current.concat([symbol]);
    watchlists.add(caller, newList);
  };

  public query ({ caller }) func getWatchlist() : async [Text] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access watchlists");
    };

    switch (watchlists.get(caller)) {
      case (null) { [] };
      case (?list) { list };
    };
  };

  public shared ({ caller }) func removeFromWatchlist(symbol : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage watchlists");
    };

    let current = switch (watchlists.get(caller)) {
      case (null) { Runtime.trap("No watchlist found") };
      case (?list) { list };
    };

    let filtered = current.filter(func(s) { s != symbol });
    watchlists.add(caller, filtered);
  };

  // Holdings functions
  public shared ({ caller }) func addHolding(holding : Holding) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage holdings");
    };

    let current = switch (holdings.get(caller)) {
      case (null) { List.empty<Holding>() };
      case (?list) { list };
    };

    current.add(holding);
    holdings.add(caller, current);
  };

  public query ({ caller }) func getHoldings() : async [Holding] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access holdings");
    };

    switch (holdings.get(caller)) {
      case (null) { [] };
      case (?list) { list.toArray() };
    };
  };

  public shared ({ caller }) func updateHolding(symbol : Text, amount : Float, buyPrice : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage holdings");
    };

    let current = switch (holdings.get(caller)) {
      case (null) { Runtime.trap("No holdings found") };
      case (?list) { list };
    };

    let newList = current.map<Holding, Holding>(
      func(h) {
        if (h.symbol == symbol) {
          { h with amount; buyPrice };
        } else {
          h;
        };
      }
    );
    holdings.add(caller, newList);
  };

  public shared ({ caller }) func removeHolding(symbol : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage holdings");
    };

    let current = switch (holdings.get(caller)) {
      case (null) { Runtime.trap("No holdings found") };
      case (?list) { list };
    };

    let filtered = current.filter(func(h) { h.symbol != symbol });
    holdings.add(caller, filtered);
  };

  // Alerts functions
  public shared ({ caller }) func addAlert(alert : Alert) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage alerts");
    };

    let current = switch (alerts.get(caller)) {
      case (null) { List.empty<Alert>() };
      case (?list) { list };
    };

    current.add(alert);
    alerts.add(caller, current);
  };

  public shared ({ caller }) func toggleAlert(symbol : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage alerts");
    };

    let current = switch (alerts.get(caller)) {
      case (null) { Runtime.trap("No alerts found") };
      case (?list) { list };
    };

    let newList = current.map<Alert, Alert>(
      func(a) {
        if (a.symbol == symbol) {
          { a with active = not a.active };
        } else {
          a;
        };
      }
    );
    alerts.add(caller, newList);
  };

  public shared ({ caller }) func removeAlert(symbol : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage alerts");
    };

    let current = switch (alerts.get(caller)) {
      case (null) { Runtime.trap("No alerts found") };
      case (?list) { list };
    };

    let filtered = current.filter(func(a) { a.symbol != symbol });
    alerts.add(caller, filtered);
  };

  public query ({ caller }) func getAlerts() : async [Alert] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access alerts");
    };

    switch (alerts.get(caller)) {
      case (null) { [] };
      case (?list) { list.toArray() };
    };
  };

  // Signals functions
  public shared ({ caller }) func createSignal(title : Text, body : Text, symbol : Text, signalType : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create signals");
    };

    let id = nextSignalId;
    nextSignalId += 1;

    let signal : Signal = {
      id;
      title;
      body;
      symbol;
      signalType;
      timestamp = Time.now();
    };

    signals.add(id, signal);
  };

  public shared ({ caller }) func deleteSignal(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete signals");
    };

    signals.remove(id);
  };

  module Signal {
    public func compare(signal1 : Signal, signal2 : Signal) : Order.Order {
      Nat.compare(signal1.id, signal2.id);
    };

    public func compareByTimestamp(signal1 : Signal, signal2 : Signal) : Order.Order {
      Int.compare(signal2.timestamp, signal1.timestamp); // Descending order
    };
  };

  public query func getSignals() : async [Signal] {
    signals.values().toArray().sort(Signal.compareByTimestamp);
  };

  // Coin data functions (public access - no authentication required)
  public query func getAllCoins() : async [Coin] {
    coins.values().toArray();
  };

  public query func getCoin(symbol : Text) : async Coin {
    switch (coins.get(symbol)) {
      case (null) { Runtime.trap("Coin not found") };
      case (?coin) { coin };
    };
  };

  module Coin {
    public func compareByChange24h(coin1 : Coin, coin2 : Coin) : Order.Order {
      Float.compare(coin2.change24h, coin1.change24h); // Descending order
    };

    public func compareByChange7d(coin1 : Coin, coin2 : Coin) : Order.Order {
      Float.compare(coin2.change7d, coin1.change7d); // Descending order
    };

    public func compareByRank(coin1 : Coin, coin2 : Coin) : Order.Order {
      Nat.compare(coin1.rank, coin2.rank);
    };
  };

  public query func getTopGainers() : async [Coin] {
    coins.values().toArray().sort(Coin.compareByChange24h);
  };

  public query func getTopLosers() : async [Coin] {
    coins.values().toArray().sort(Coin.compareByChange7d);
  };

  public query func getMarketSentiment() : async Float {
    var sentiment : Float = 50.0;
    for (coin in coins.values()) {
      sentiment += coin.change24h * 0.1;
      sentiment += coin.change7d * 0.05;
    };
    Float.min(100.0, Float.max(0.0, sentiment));
  };

  public query func getCandleData(symbol : Text, timeframe : Text) : async [Candle] {
    let _ = timeframe; // Ignored for now (only returns 1h candles)
    switch (candles.get(symbol)) {
      case (null) { [] };
      case (?candles) { candles };
    };
  };
};
